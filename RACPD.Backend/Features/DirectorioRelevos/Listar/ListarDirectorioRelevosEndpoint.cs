using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.DirectorioRelevos.Listar;

/// <summary>
/// Lista los cuidadores de apoyo del directorio de relevos visibles para el
/// usuario autenticado.
///
/// Tenancy clínica: el usuario (CuidadorPrincipal o Apoyo) solo ve a
/// co-cuidadores que comparten al menos un PerfilDependiente activo vía
/// VinculoDependiente.
///
/// Query params (todos opcionales):
///   - terminoBusqueda  (string) : filtra por Nombre (case-insensitive, ILIKE).
///   - estado           (string) : "Disponible" | "NoDisponible" | null (= todos).
///
/// Coherencia con Usuario:
/// Si el UsuarioApoyo NO está Activo, el relevo se trata como
/// NoDisponible para todos los efectos. Esto se evalúa en el SQL
/// (proyectando el estado efectivo) ANTES de aplicar el filtro de estado,
/// para que el resultado de "?estado=Disponible" NUNCA contenga un
/// relevo inactivo.
///
/// El valor persistido en <c>DirectorioRelevo.Estado</c> NO se modifica;
/// la coerción es solo de lectura.
///
/// Errores: RFC 7807 vía ProblemDetailsHelper.
/// </summary>
public class ListarDirectorioRelevosEndpoint
    : Endpoint<ListarDirectorioRelevosRequest, List<RelevoItemResponse>>
{
    private readonly AppDbContext _db;

    public ListarDirectorioRelevosEndpoint(AppDbContext db)
    {
        _db = db;
    }

    public override void Configure()
    {
        Get("/api/directorio-relevos");
        Roles(Rol.CuidadorPrincipal.ToString(), Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(ListarDirectorioRelevosRequest req, CancellationToken ct)
    {
        var usuarioId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // === IDs de PerfilesDependiente a los que el usuario está vinculado ===
        var perfilesVisibles = await _db.VinculosDependientes
            .AsNoTracking()
            .Where(v =>
                v.UsuarioId == usuarioId.Value &&
                v.Activo &&
                v.PerfilDependiente.Activo)
            .Select(v => v.PerfilDependienteId)
            .Distinct()
            .ToListAsync(ct);

        if (perfilesVisibles.Count == 0)
        {
            await Send.OkAsync(new List<RelevoItemResponse>(), ct);
            return;
        }

        // === Base query ===
        var query = _db.DirectorioRelevos
            .AsNoTracking()
            .Where(d =>
                d.Activo &&
                d.Listado &&
                perfilesVisibles.Contains(d.PerfilDependienteId));

        if (!string.IsNullOrWhiteSpace(req.TerminoBusqueda))
        {
            var termino = req.TerminoBusqueda.Trim();
            query = query.Where(d => EF.Functions.ILike(d.Nombre, $"%{termino}%"));
        }

        // === Estado EFECTIVO en SQL ===
        // EstadoEfectivo =
        //   - Si UsuarioApoyo.Estado == Activo → DirectorioRelevo.Estado (persistido)
        //   - Si no → NoDisponible (fallback)
        //
        // Aplicamos el filtro de estado SOBRE el estado efectivo, no sobre
        // el persistido. Esto garantiza que "?estado=Disponible" excluya
        // cualquier relevo cuya cuenta de usuario esté inactiva.
        var estadoUsuarioActivo = EstadoUsuario.Activo;
        var estadoNoDisponible = EstadoDirectorioRelevo.NoDisponible;

        var queryConEstadoEfectivo = query.Select(d => new
        {
            d.Id,
            d.Nombre,
            d.Telefono,
            EstadoEfectivo = d.UsuarioApoyo.Estado == estadoUsuarioActivo
                ? d.Estado
                : estadoNoDisponible
        });

        // Filtro de estado SOBRE el estado efectivo (server-side).
        EstadoDirectorioRelevo? estadoFiltro = null;
        if (!string.IsNullOrWhiteSpace(req.Estado) &&
            Enum.TryParse<EstadoDirectorioRelevo>(req.Estado, ignoreCase: true, out var parsed))
        {
            estadoFiltro = parsed;
        }

        var queryFinal = estadoFiltro is null
            ? queryConEstadoEfectivo
            : queryConEstadoEfectivo.Where(x => x.EstadoEfectivo == estadoFiltro);

        var resultado = await queryFinal
            .OrderBy(x => x.Nombre)
            .ToListAsync(ct);

        // Deduplicar por Teléfono (un cuidador puede apoyar a varios
        // dependientes del mismo usuario y aparecería duplicado).
        var resultadoUnico = resultado
            .DistinctBy(x => x.Telefono)
            .Select(x => new RelevoItemResponse(
                Id: x.Id,
                Nombre: x.Nombre,
                Telefono: x.Telefono,
                Estado: x.EstadoEfectivo))
            .ToList();

        await Send.OkAsync(resultadoUnico, ct);
    }
}

public class ListarDirectorioRelevosRequest
{
    public string? TerminoBusqueda { get; init; }
    public string? Estado { get; init; }
}

public record RelevoItemResponse(
    Guid Id,
    string Nombre,
    string Telefono,
    EstadoDirectorioRelevo Estado
);
