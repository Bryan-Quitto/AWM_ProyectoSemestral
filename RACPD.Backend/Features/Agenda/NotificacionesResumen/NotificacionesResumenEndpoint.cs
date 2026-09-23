using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
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

        // === Semana en Ecuador (lunes a domingo) ===
        var hoyEcuador = ZonaEcuador.HoyLocal;
        // DayOfWeek: Sunday=0, Monday=1, ..., Saturday=6.
        // Para que la semana inicie en lunes: domingo -> 6, lunes -> 0, martes -> 1, ...
        var diasDesdeInicioSemana = hoyEcuador.DayOfWeek switch
        {
            DayOfWeek.Sunday => 6,
            _ => (int)hoyEcuador.DayOfWeek - 1,
        };
        var inicioSemana = hoyEcuador.AddDays(-diasDesdeInicioSemana);
        var finSemana = inicioSemana.AddDays(6);
        var manana = hoyEcuador.AddDays(1);

        // === Visibilidad por dependiente (idem Listar) ===
        var idsDependientesVisibles = await _dbContext.VinculosDependientes
            .AsNoTracking()
            .Where(v => v.UsuarioId == usuarioId && v.Activo)
            .Select(v => v.PerfilDependienteId)
            .ToArrayAsync(ct);

        // === Trip 1: Bloques Unica dentro de la semana (incluido hoy) ===
        // Logica equivalente a ListarBloquesEndpoint para no introducir
        // divergencias con el calendario.
        var bloquesSemana = await _dbContext.BloquesTurno
            .AsNoTracking()
            .Include(b => b.CreadoPor)
            .Include(b => b.PerfilDependiente)
            .Include(b => b.Reservas.Where(r => r.Activa))
                .ThenInclude(r => r.Usuario)
            .Where(b =>
                b.TipoRecurrencia == TipoRecurrencia.Unica
                && b.Fecha >= inicioSemana
                && b.Fecha <= finSemana)
            .Where(b => esAdministrador
                || idsDependientesVisibles.Contains(b.PerfilDependienteId))
            .ToListAsync(ct);

        // Materializar en memoria las notificaciones del usuario.
        // "Hoy" = turnos donde el usuario es creador o tiene Reserva activa.
        // "Semana" = todos los turnos restantes de la semana visibles.
        var hoy = new List<NotificacionTurnoDto>();
        var semana = new List<NotificacionTurnoDto>();

        foreach (var b in bloquesSemana)
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

            if (b.Fecha == hoyEcuador && meRelevo)
            {
                hoy.Add(dto);
            }
            else if (b.Fecha >= manana && b.Fecha <= finSemana)
            {
                semana.Add(dto);
            }
        }

        // Ordenar cronologicamente para presentacion consistente.
        hoy = hoy.OrderBy(t => t.HoraInicio).ToList();
        semana = semana.OrderBy(t => t.DependienteNombre).ThenBy(t => t.HoraInicio).ToList();

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
    string HoraInicio,   // "HH:mm"
    string HoraFin,      // "HH:mm"
    string? CuidadorAsignadoNombre,
    string Estado         // EstadoRelevo: Disponible/Asignado/Cancelado/Completado
);

public record NotificacionesResumenResponse(
    IReadOnlyList<NotificacionTurnoDto> Hoy,
    IReadOnlyList<NotificacionTurnoDto> Semana
);