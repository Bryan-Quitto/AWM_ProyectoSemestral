using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.Vinculos.DesactivarVinculo;

/// <summary>
/// Soft-delete de un vínculo. Solo el cuidador principal del perfil puede
/// desactivar un vínculo. El cuidador principal NO puede desactivar su propio
/// vínculo activo (debe primero transferir el cuidado o desactivar el perfil).
/// </summary>
public class DesactivarVinculoEndpoint : EndpointWithoutRequest
{
    private readonly AppDbContext _dbContext;

    public DesactivarVinculoEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Delete("/api/perfiles-dependientes/{id}/vinculos/{vinculoId}");
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

        if (!Guid.TryParse(Route<string>("id"), out var perfilId)
            || !Guid.TryParse(Route<string>("vinculoId"), out var vinculoId))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["ruta"] = new[] { "Los identificadores de la ruta deben ser Guid válidos." }
                },
                "Identificadores inválidos.");
            return;
        }

        // Solo el cuidador principal del perfil puede desactivar vínculos.
        var esCuidadorDelPerfil = await _dbContext.VinculosDependientes
            .AnyAsync(v => v.UsuarioId == userId.Value
                        && v.PerfilDependienteId == perfilId
                        && v.Activo
                        && v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal, ct);

        if (!esCuidadorDelPerfil)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal del perfil puede desactivar vínculos.",
                tipoProhibido: "sin-permiso-gestionar-vinculos");
            return;
        }

        var vinculo = await _dbContext.VinculosDependientes
            .FirstOrDefaultAsync(v => v.Id == vinculoId && v.PerfilDependienteId == perfilId, ct);

        if (vinculo is null || !vinculo.Activo)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El vínculo no existe o ya fue desactivado.",
                tipoRecurso: "vinculo-no-encontrado");
            return;
        }

        // El cuidador principal no puede desactivarse a sí mismo (debe transferir o desactivar perfil).
        if (vinculo.UsuarioId == userId.Value && vinculo.RolEnDependiente == RolEnDependiente.CuidadorPrincipal)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "El cuidador principal no puede desactivar su propio vínculo. Primero designe a otro cuidador principal o desactive el perfil completo.",
                tipoConflicto: "no-puede-desactivar-su-propio-cuidado");
            return;
        }

        vinculo.Activo = false;
        await _dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
