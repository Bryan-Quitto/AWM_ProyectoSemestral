using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.UltimaBitacora;

/// <summary>
/// Endpoint GET /api/agenda/ultima-bitacora
///
/// Retorna la BitacoraTurno más reciente (por FechaCierre DESC) registrada
/// por el usuario autenticado. Diseñado exclusivamente para el KPI
/// "Último ánimo reportado" del Dashboard.
///
/// Por qué este endpoint y no ordenar en el cliente:
///   El cliente tenía acceso a BloquesTurno con EstaCompletado=true, pero
///   ordenaba por (Fecha + HoraInicio) del BLOQUE, no por FechaCierre de la
///   BitacoraTurno. Esto causaba que un turno de 08:00 cerrado a las 17:00
///   quedara tapado por uno de 09:32 cerrado antes a las 14:52.
///   El backend es el único que conoce FechaCierre y puede ordenar correctamente.
///
/// Reglas:
///  R1 — Solo roles CuidadorPrincipal y Apoyo.
///  R2 — Retorna 404 si el usuario no tiene ninguna bitácora registrada.
///  R3 — Two-query pattern: (1) bitácora+registrador, (2) bloque para tareas JSONB.
///  R4 — Tenancy: solo bitácoras donde RegistradoPorUsuarioId = usuarioId.
///
/// Errores: RFC 7807 estricto vía ProblemDetailsHelper.
/// </summary>
public class UltimaBitacoraEndpoint : EndpointWithoutRequest<BitacoraTurnoDetalleDto>
{
    private readonly AppDbContext _dbContext;

    public UltimaBitacoraEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/agenda/ultima-bitacora");
        Roles(
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var usuarioId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // Query 1: bitácora más reciente por FechaCierre DESC + registrador
        // FechaCierre es cuando el cuidador cerró el turno — fuente de verdad correcta.
        var bitacora = await _dbContext.BitacorasTurno
            .AsNoTracking()
            .Include(b => b.RegistradoPor)
            .Where(b => b.RegistradoPorUsuarioId == usuarioId.Value && b.Activa)
            .OrderByDescending(b => b.FechaCierre)
            .FirstOrDefaultAsync(ct);

        if (bitacora is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "No hay bitácoras registradas por este usuario.",
                tipoRecurso: "ultima-bitacora-no-encontrada");
            return;
        }

        // Query 2: bloque para obtener Tareas (JSONB almacenado en el bloque maestro)
        var bloque = await _dbContext.BloquesTurno
            .AsNoTracking()
            .Where(b => b.Id == bitacora.BloqueTurnoId)
            .Select(b => new { b.Tareas })
            .FirstOrDefaultAsync(ct);

        var nombreCompleto = $"{bitacora.RegistradoPor.Nombre} {bitacora.RegistradoPor.Apellido}".Trim();

        var dto = new BitacoraTurnoDetalleDto(
            Id: bitacora.Id,
            BloqueTurnoId: bitacora.BloqueTurnoId,
            EstadoAnimo: bitacora.EstadoAnimo.ToString(),
            Sintomas: bitacora.Sintomas,
            HorasSueno: bitacora.HorasSueno,
            ObservacionesGenerales: bitacora.ObservacionesGenerales,
            FechaCierre: bitacora.FechaCierre,
            RegistradoPor: new UsuarioResumenDto(bitacora.RegistradoPor.Id, nombreCompleto),
            TareasRealizadasIds: bitacora.TareasRealizadasIds ?? new List<Guid>(),
            TareasDelBloque: (bloque?.Tareas ?? new List<Domain.Entities.TareaTurnoItem>())
                .OrderBy(t => t.Orden)
                .Select(t => new TareaTurnoDto(t.Id, t.Descripcion, t.Orden))
                .ToList()
        );

        await Send.OkAsync(dto, ct);
    }
}
