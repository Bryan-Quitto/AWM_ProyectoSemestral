using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.ListarMisDependientes;

public class ListarMisDependientesEndpoint : EndpointWithoutRequest<List<DependienteResumenResponse>>
{
    private readonly AppDbContext _dbContext;

    public ListarMisDependientesEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/perfiles-dependientes/mios");
        Roles(Rol.CuidadorPrincipal.ToString(), Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (userId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // Solo perfiles activos: los desactivados (soft-delete) no se listan.
        // Traemos el PerfilDependiente completo vía Include para poder proyectar
        // AlergiasEstructuradas (List<string>) a string[] en cliente. EF Core no
        // puede traducir la proyección de List<string> -> string[] dentro del
        // árbol de expresiones, así que la conversión se hace tras materializar.
        var vinculos = await _dbContext.VinculosDependientes
            .Where(v => v.UsuarioId == userId.Value && v.Activo && v.PerfilDependiente.Activo)
            .Include(v => v.PerfilDependiente)
            .OrderByDescending(v => v.FechaAsignacion)
            .ToListAsync(ct);

        var resultado = vinculos
            .Select(v => new DependienteResumenResponse
            {
                PerfilId = v.PerfilDependienteId,
                NombreCompleto = v.PerfilDependiente.NombreCompleto,
                TipoSangre = v.PerfilDependiente.TipoSangre.ToString(),
                RolEnDependiente = v.RolEnDependiente.ToString(),
                PuedeEditar = v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal,
                FechaAsignacion = v.FechaAsignacion,
                CondicionesCronicas = v.PerfilDependiente.CondicionesCronicas,
                AlergiasEstructuradas = v.PerfilDependiente.AlergiasEstructuradas.ToArray()
            })
            .ToList();

        await Send.OkAsync(resultado, ct);
    }
}

public class DependienteResumenResponse
{
    public Guid PerfilId { get; init; }
    public string NombreCompleto { get; init; } = string.Empty;
    public string TipoSangre { get; init; } = string.Empty;
    public string RolEnDependiente { get; init; } = string.Empty;
    public bool PuedeEditar { get; init; }
    public DateTimeOffset FechaAsignacion { get; init; }
    public string? CondicionesCronicas { get; init; }
    public string[] AlergiasEstructuradas { get; init; } = Array.Empty<string>();
}
