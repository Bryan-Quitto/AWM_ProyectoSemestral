using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.NotificacionesResumen;

/// <summary>
/// Endpoint GET /api/agenda/notificaciones-resumen — Persona 3 / Semana 2.
///
/// Devuelve el resumen que consume el Popover de la Campana en el Navbar:
///   * Hoy: turnos cuya fecha es HOY en Ecuador (America/Guayaquil).
///   * Semana: turnos entre mañana y el domingo de la misma semana (lunes a domingo).
///
/// Reglas de visibilidad (Cero-Indulgencia, idem ListarBloquesEndpoint):
///   - CuidadorPrincipal / Apoyo: solo turnos de PerfilesDependientes vinculados.
///   - AdministradorSistema: bypass del filtro de visibilidad (rol admin).
///
/// Errores: RFC 7807 estricto via ProblemDetailsHelper.
/// </summary>
public class NotificacionesResumenEndpoint : EndpointWithoutRequest<NotificacionesResumenResponse>
{
    private readonly AppDbContext _dbContext;

    public NotificacionesResumenEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/agenda/notificaciones-resumen");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var usuarioIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(usuarioIdString) || !Guid.TryParse(usuarioIdString, out var usuarioId))
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        var rolClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? User.FindFirstValue("role");
        var esAdministrador = rolClaim?.Equals(Rol.AdministradorSistema.ToString(), StringComparison.OrdinalIgnoreCase) == true;

        // === Ventana deslizante de 7 días en Ecuador (hoy a hoy + 6 días) ===
        // Proporciona un horizonte de previsión constante de 7 días continuos,
        // eliminando la pérdida de visibilidad que ocurría al final de la semana calendario.
        var hoyEcuador = ZonaEcuador.HoyLocal;
        var finVentana = hoyEcuador.AddDays(6);

        // === Visibilidad por dependiente (idem Listar) ===
        var idsDependientesVisibles = await _dbContext.VinculosDependientes
            .AsNoTracking()
            .Where(v => v.UsuarioId == usuarioId && v.Activo)
            .Select(v => v.PerfilDependienteId)
            .ToArrayAsync(ct);

        // === Trip 1: Bloques dentro de la ventana de 7 días (incluido hoy) ===
        // Soportamos TipoRecurrencia.Unica y TipoRecurrencia.Semanas (con proyección de ocurrencias),
        // alineado con la lógica de ListarBloquesEndpoint para no omitir turnos recurrentes en el Radar.
        var bloquesCandidatos = await _dbContext.BloquesTurno
            .AsNoTracking()
            .Include(b => b.CreadoPor)
            .Include(b => b.PerfilDependiente)
            .Include(b => b.Reservas.Where(r => r.Activa))
                .ThenInclude(r => r.Usuario)
            .Where(b =>
                (b.TipoRecurrencia == TipoRecurrencia.Unica
                    && b.Fecha >= hoyEcuador
                    && b.Fecha <= finVentana)
                || (b.TipoRecurrencia == TipoRecurrencia.Semanas
                    && b.Fecha <= finVentana))
            .Where(b => esAdministrador
                || idsDependientesVisibles.Contains(b.PerfilDependienteId))
            .ToListAsync(ct);

        // Proyectar ocurrencias en memoria para turnos recurrentes
        var ocurrencias = new List<(BloqueTurno Maestro, DateOnly FechaOc)>();
        foreach (var b in bloquesCandidatos)
        {
            switch (b.TipoRecurrencia)
            {
                case TipoRecurrencia.Unica:
                    if (b.Fecha >= hoyEcuador && b.Fecha <= finVentana)
                    {
                        ocurrencias.Add((b, b.Fecha));
                    }
                    break;

                case TipoRecurrencia.Semanas
                    when b.IntervaloSemanas is int n && n >= 1 && n <= 24:
                    {
                        var paso = n * 7;
                        for (var d = b.Fecha; d <= finVentana; d = d.AddDays(paso))
                        {
                            if (d >= hoyEcuador)
                            {
                                ocurrencias.Add((b, d));
                            }
                        }
                    }
                    break;
            }
        }

        // Materializar en memoria las notificaciones del usuario.
        // "Hoy" = turnos donde el usuario es creador o tiene Reserva activa.
        // "Semana" = todos los turnos restantes de los próximos días (mañana a hoy + 6 días).
        var hoy = new List<NotificacionTurnoDto>();
        var semana = new List<NotificacionTurnoDto>();

        foreach (var (b, fechaOc) in ocurrencias)
        {
            // Estado derivado de las reservas activas (BloqueTurno no tiene campo Estado).
            var reservasActivas = b.Reservas.Where(r => r.Activa).ToList();
            var estadoStr = reservasActivas.Count > 0
                ? EstadoRelevo.Asignado.ToString()
                : EstadoRelevo.Disponible.ToString();

            var dto = new NotificacionTurnoDto(
                BloqueId: b.Id,
                PerfilDependienteId: b.PerfilDependienteId,
                DependienteNombre: b.PerfilDependiente?.NombreCompleto ?? "Sin dependiente",
                Fecha: fechaOc,
                HoraInicio: b.HoraInicio.ToString("HH:mm"),
                HoraFin: b.HoraFin.ToString("HH:mm"),
                CuidadorAsignadoNombre: b.CreadoPorId == usuarioId
                    ? "Yo"
                    : reservasActivas.FirstOrDefault()?.Usuario is { } u
                        ? $"{u.Nombre} {u.Apellido}".Trim()
                        : null,
                Estado: estadoStr
            );

            var meRelevo = b.CreadoPorId == usuarioId
                || reservasActivas.Any(r => r.UsuarioId == usuarioId);

            if (fechaOc == hoyEcuador && meRelevo)
            {
                hoy.Add(dto);
            }
            else if (fechaOc > hoyEcuador && fechaOc <= finVentana)
            {
                // Cobertura de los próximos días: incluye cualquier bloque visible de la ventana
                // posterior al día de hoy.
                semana.Add(dto);
            }
        }

        // Ordenar cronologicamente para presentacion consistente.
        // (Antes `semana` ordenaba por DependienteNombre — corregido para que
        // el frontend pueda derivar la etiqueta del día desde el orden real.)
        hoy = hoy.OrderBy(t => t.HoraInicio).ToList();
        semana = semana
            .OrderBy(t => t.Fecha)
            .ThenBy(t => t.HoraInicio)
            .ToList();

        await Send.OkAsync(
            new NotificacionesResumenResponse(hoy, semana),
            ct);
    }
}

/// <summary>
/// DTO de un turno en el resumen de notificaciones.
/// Coincide con la forma usada por la Campana en el Frontend (se migra
/// al equivalente Orval cuando se regenere).
/// </summary>
public record NotificacionTurnoDto(
    Guid BloqueId,
    Guid PerfilDependienteId,
    string DependienteNombre,
    DateOnly Fecha,        // Fecha local Ecuador del bloque; permite al FE
                            // etiquetar correctamente "Miércoles 23 sept" en el radar.
    string HoraInicio,   // "HH:mm"
    string HoraFin,      // "HH:mm"
    string? CuidadorAsignadoNombre,
    string Estado         // EstadoRelevo: Disponible/Asignado/Cancelado/Completado
);

public record NotificacionesResumenResponse(
    IReadOnlyList<NotificacionTurnoDto> Hoy,
    IReadOnlyList<NotificacionTurnoDto> Semana
);