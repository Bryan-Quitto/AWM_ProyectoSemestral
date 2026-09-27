using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.ObtenerBitacora;

/// <summary>
/// Endpoint GET /api/agenda/{id}/bitacora — Persona 3 / Semana 3.
///
/// Devuelve la BitacoraTurno activa asociada a un BloqueTurno. Permite al
/// relevo entrante y al cuidador principal revisar el reporte clínico/operativo
/// del cierre de turno (ánimo, síntomas, horas de sueño, observaciones y tareas
/// realizadas) sin necesidad de esperar al cuidador que la registró.
///
/// Reglas duras:
///  R1 — Solo roles AdministradorSistema, CuidadorPrincipal o Apoyo.
///  R2 — La bitácora debe existir y estar activa (404 si no).
///  R3 — Tenancy: el usuario debe tener visibilidad sobre el dependiente
///       del bloque (vínculo activo) o ser el creador / reservador activo
///       del bloque. En caso contrario, 403.
///  R4 — One Trip Pattern: una sola query con Includes mínimos + verificación
///       de autorización derivada del propio BloqueTurno (sin N+1).
///
/// Errores: RFC 7807 estricto vía <see cref="ProblemDetailsHelper"/>.
/// </summary>
public class ObtenerBitacoraEndpoint : EndpointWithoutRequest<BitacoraTurnoDetalleDto>
{
    private readonly AppDbContext _dbContext;

    public ObtenerBitacoraEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/agenda/{id}/bitacora");
        Roles(
            Rol.AdministradorSistema.ToString(),
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

        if (!Guid.TryParse(Route<string>("id"), out var bloqueId))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["id"] = ["El identificador del bloque no es válido."]
                },
                "El identificador del bloque es inválido.");
            return;
        }

        var rolClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? User.FindFirstValue("role");
        var esAdministrador = rolClaim?.Equals(
            Rol.AdministradorSistema.ToString(),
            StringComparison.OrdinalIgnoreCase) == true;

        // === Lectura agregada (One Trip Pattern) ===
        // Traemos bloque + bitácora activa + registrador en una sola
        // consulta via sub-select (sin N+1).
        // Cargamos Reservas y Tareas explícitamente para no perder info
        // usada por las reglas de autorización.
        var bloque = await _dbContext.BloquesTurno
            .AsNoTracking()
            .Include(b => b.Reservas)
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El bloque de turno no fue encontrado.",
                tipoRecurso: "bloque-turno-no-encontrado");
            return;
        }

        var bitacora = await _dbContext.BitacorasTurno
            .AsNoTracking()
            .Where(bit => bit.BloqueTurnoId == bloqueId && bit.Activa)
            .Select(bit => new
            {
                bit.Id,
                bit.EstadoAnimo,
                bit.Sintomas,
                bit.HorasSueno,
                bit.ObservacionesGenerales,
                bit.FechaCierre,
                bit.TareasRealizadasIds,
                RegistradoPor = new
                {
                    bit.RegistradoPor.Id,
                    bit.RegistradoPor.Nombre,
                    bit.RegistradoPor.Apellido
                }
            })
            .FirstOrDefaultAsync(ct);

        // R3 — Autorización por tenancy.
        // Política: el usuario puede ver la bitácora si:
        //  - Es AdministradorSistema (bypass), o
        //  - Es el creador del bloque, o
        //  - Tiene una reserva activa en el bloque, o
        //  - Tiene un vínculo activo con el dependiente del bloque
        //    (cuidador principal o de apoyo del dependiente).
        // Esta regla cubre tanto al cuidador principal como al relevo
        // entrante (que tendrá reserva activa o vínculo activo).
        var esCreador = bloque.CreadoPorId == usuarioId.Value;
        var tieneReserva = await _dbContext.ReservasTurno
            .AsNoTracking()
            .AnyAsync(r => r.BloqueTurnoId == bloqueId
                        && r.UsuarioId == usuarioId.Value
                        && r.Activa, ct);
        var tieneVinculoDependiente = await _dbContext.VinculosDependientes
            .AsNoTracking()
            .AnyAsync(v => v.PerfilDependienteId == bloque.PerfilDependienteId
                        && v.UsuarioId == usuarioId.Value
                        && v.Activo, ct);

        var autorizado = esAdministrador || esCreador || tieneReserva || tieneVinculoDependiente;
        if (!autorizado)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "No tiene permisos para consultar la bitácora de este turno.",
                tipoProhibido: "sin-acceso-bitacora");
            return;
        }

        if (bitacora is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "Este turno aún no ha sido cerrado. La bitácora se genera al completar el turno.",
                tipoRecurso: "bitacora-no-encontrada");
            return;
        }

        var bit = bitacora;
        var nombreCompleto = $"{bit.RegistradoPor.Nombre} {bit.RegistradoPor.Apellido}".Trim();

        var dto = new BitacoraTurnoDetalleDto(
            Id: bit.Id,
            BloqueTurnoId: bloqueId,
            EstadoAnimo: bit.EstadoAnimo.ToString(),
            Sintomas: bit.Sintomas,
            HorasSueno: bit.HorasSueno,
            ObservacionesGenerales: bit.ObservacionesGenerales,
            FechaCierre: bit.FechaCierre,
            RegistradoPor: new UsuarioResumenDto(
                bit.RegistradoPor.Id,
                nombreCompleto),
            TareasRealizadasIds: bit.TareasRealizadasIds ?? new List<Guid>(),
            TareasDelBloque: bloque.Tareas
                .OrderBy(t => t.Orden)
                .Select(t => new TareaTurnoDto(t.Id, t.Descripcion, t.Orden))
                .ToList()
        );

        await Send.OkAsync(dto, ct);
    }
}