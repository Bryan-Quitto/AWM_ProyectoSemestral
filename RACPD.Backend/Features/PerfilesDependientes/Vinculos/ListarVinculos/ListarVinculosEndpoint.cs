using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.Vinculos.ListarVinculos;

public class ListarVinculosEndpoint : EndpointWithoutRequest<List<VinculoResponse>>
{
    private readonly AppDbContext _dbContext;

    public ListarVinculosEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/perfiles-dependientes/{id}/vinculos");
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

        // Verificar vínculo activo del solicitante con el perfil.
        var tieneVinculo = await _dbContext.VinculosDependientes
            .AnyAsync(v => v.UsuarioId == userId.Value
                        && v.PerfilDependienteId == perfilId
                        && v.Activo, ct);

        if (!tieneVinculo)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "No tiene un vínculo activo con este perfil dependiente.",
                tipoProhibido: "sin-vinculo-dependiente");
            return;
        }

        var vinculos = await _dbContext.VinculosDependientes
            .Where(v => v.PerfilDependienteId == perfilId && v.Activo)
            .Select(v => new VinculoResponse
            {
                VinculoId = v.Id,
                UsuarioId = v.UsuarioId,
                NombreCompletoUsuario = v.Usuario.Nombre + " " + v.Usuario.Apellido,
                CorreoUsuario = v.Usuario.Correo,
                RolEnDependiente = v.RolEnDependiente.ToString(),
                FechaAsignacion = v.FechaAsignacion
            })
            .OrderByDescending(v => v.FechaAsignacion)
            .ToListAsync(ct);

        await Send.OkAsync(vinculos, ct);
    }
}

public class VinculoResponse
{
    public Guid VinculoId { get; init; }
    public Guid UsuarioId { get; init; }
    public string NombreCompletoUsuario { get; init; } = string.Empty;
    public string CorreoUsuario { get; init; } = string.Empty;
    public string RolEnDependiente { get; init; } = string.Empty;
    public DateTimeOffset FechaAsignacion { get; init; }
}
