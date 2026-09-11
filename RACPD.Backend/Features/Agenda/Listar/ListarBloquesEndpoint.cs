using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.Listar;

public record Response(IReadOnlyList<BloqueTurnoDto> Data);

public class ListarBloquesEndpoint : EndpointWithoutRequest<Response>
{
    private readonly AppDbContext _dbContext;

    public ListarBloquesEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/agenda");
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

        var esPrincipal = rolClaim?.Equals(Rol.CuidadorPrincipal.ToString(), StringComparison.OrdinalIgnoreCase) == true;

        // Parámetros de filtro (todos opcionales)
        var filtro = Query<string>("filtro", isRequired: false) ?? "Todos";

        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var fechaDesde = hoy;
        var fechaHasta = hoy.AddDays(30);

        // Intentar parsear fechas si vienen como query params
        var fechaDesdeStr = Query<string>("fechaDesde", isRequired: false);
        var fechaHastaStr = Query<string>("fechaHasta", isRequired: false);

        if (!string.IsNullOrEmpty(fechaDesdeStr) && DateOnly.TryParse(fechaDesdeStr, out var parsedDesde))
        {
            fechaDesde = parsedDesde;
        }
        if (!string.IsNullOrEmpty(fechaHastaStr) && DateOnly.TryParse(fechaHastaStr, out var parsedHasta))
        {
            fechaHasta = parsedHasta;
        }

        // Consultar bloques — Single-trip con Include para evitar N+1.
        var bloques = await _dbContext.BloquesTurno
            .AsNoTracking()
            .Include(b => b.CreadoPor)
            .Include(b => b.PerfilDependiente)
            .Include(b => b.Reservas)
                .ThenInclude(r => r.Usuario)
            .Where(b => b.Fecha >= fechaDesde && b.Fecha <= fechaHasta)
            .ToListAsync(ct);

        // Aplicar filtro en memoria
        if (filtro == "MisBloques" && esPrincipal)
        {
            bloques = bloques.Where(b => b.CreadoPorId == usuarioId).ToList();
        }
        else if (filtro == "MisReservas")
        {
            bloques = bloques.Where(b => b.Reservas.Any(r => r.UsuarioId == usuarioId && r.Activa)).ToList();
        }
        else if (filtro == "Disponibles")
        {
            bloques = bloques.Where(b => b.CuposMaximos > b.Reservas.Count(r => r.Activa)).ToList();
        }

        var bloquesDto = bloques
            .OrderBy(b => b.Fecha)
            .ThenBy(b => b.HoraInicio)
            .Select(b =>
            {
                var reservasActivas = b.Reservas.Where(r => r.Activa).ToList();
                var miReserva = reservasActivas.FirstOrDefault(r => r.UsuarioId == usuarioId);
                var esMiBloque = b.CreadoPorId == usuarioId;
                var cuposDisponibles = b.CuposMaximos - reservasActivas.Count;
                var puedoReservar = !esMiBloque
                    && !b.EstaVencido
                    && cuposDisponibles > 0
                    && miReserva == null;

                return new BloqueTurnoDto(
                    Id: b.Id,
                    Fecha: b.Fecha.ToString("yyyy-MM-dd"),
                    HoraInicio: b.HoraInicio.ToString("HH:mm:ss"),
                    HoraFin: b.HoraFin.ToString("HH:mm:ss"),
                    CuposMaximos: b.CuposMaximos,
                    CuposDisponibles: cuposDisponibles,
                    Descripcion: b.Descripcion,
                    CreadoPor: new UsuarioResumenDto(
                        b.CreadoPor.Id,
                        $"{b.CreadoPor.Nombre} {b.CreadoPor.Apellido}".Trim()
                    ),
                    Reservas: reservasActivas.Select(r => new ReservaTurnoDto(
                        r.Id,
                        new UsuarioResumenDto(
                            r.Usuario.Id,
                            $"{r.Usuario.Nombre} {r.Usuario.Apellido}".Trim()
                        ),
                        r.UsuarioId == usuarioId
                    )).ToList(),
                    PuedoReservar: puedoReservar,
                    YaReservé: miReserva != null,
                    // === NUEVO (Persona 1 / Semana 1) ===
                    PerfilDependienteId: b.PerfilDependienteId,
                    NombreDependiente: b.PerfilDependiente?.NombreCompleto ?? string.Empty,
                    TipoRecurrencia: b.TipoRecurrencia.ToString(),
                    IntervaloSemanas: b.IntervaloSemanas,
                    Tareas: (b.Tareas ?? new List<RACPD.Backend.Domain.Entities.TareaTurnoItem>())
                        .OrderBy(t => t.Orden)
                        .Select(t => new TareaTurnoDto(t.Id, t.Descripcion, t.Orden))
                        .ToList()
                );
            }).ToList();

        await Send.OkAsync(new Response(bloquesDto), ct);
    }
}
