using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.DesactivarPerfilDependiente;

/// <summary>
/// Soft-delete de un perfil dependiente. Solo el cuidador principal del perfil
/// puede desactivarlo. Desactivar el perfil también desactiva todos los vínculos
/// asociados, de modo que nadie más pueda verlo.
/// </summary>
public class DesactivarPerfilDependienteEndpoint : EndpointWithoutRequest
{
    private readonly AppDbContext _dbContext;

    public DesactivarPerfilDependienteEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Delete("/api/perfiles-dependientes/{id}");
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

        if (!Guid.TryParse(Route<string>("id"), out var perfilId))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["id"] = new[] { "El identificador del perfil debe ser un Guid válido." }
                },
                "Identificador inválido.");
            return;
        }

        // Solo el cuidador principal del perfil puede desactivarlo.
        var esCuidadorDelPerfil = await _dbContext.VinculosDependientes
            .AnyAsync(v => v.UsuarioId == userId.Value
                        && v.PerfilDependienteId == perfilId
                        && v.Activo
                        && v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal, ct);

        if (!esCuidadorDelPerfil)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal del perfil puede desactivarlo.",
                tipoProhibido: "sin-permiso-desactivar-dependiente");
            return;
        }

        var perfil = await _dbContext.PerfilesDependientes
            .FirstOrDefaultAsync(p => p.Id == perfilId && p.Activo, ct);

        if (perfil is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El perfil dependiente no existe o ya fue desactivado.",
                tipoRecurso: "perfil-dependiente-no-encontrado");
            return;
        }

        perfil.Desactivar();

        // Desactivar también todos los vínculos activos del perfil.
        var vinculosActivos = await _dbContext.VinculosDependientes
            .Where(v => v.PerfilDependienteId == perfilId && v.Activo)
            .ToListAsync(ct);

        foreach (var vinculo in vinculosActivos)
        {
            vinculo.Activo = false;
        }

        await _dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
