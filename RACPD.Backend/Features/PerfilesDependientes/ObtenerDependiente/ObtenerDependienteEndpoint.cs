using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.ObtenerDependiente;

public class ObtenerDependienteEndpoint : EndpointWithoutRequest<ObtenerDependienteResponse>
{
    private readonly AppDbContext _dbContext;

    public ObtenerDependienteEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/perfiles-dependientes/{id}");
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

        // Verificar vínculo activo (cualquier rol en el dependiente).
        var vinculo = await _dbContext.VinculosDependientes
            .Where(v => v.UsuarioId == userId.Value
                     && v.PerfilDependienteId == perfilId
                     && v.Activo)
            .Select(v => new { v.RolEnDependiente })
            .FirstOrDefaultAsync(ct);

        if (vinculo is null)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "No tiene un vínculo activo con este perfil dependiente.",
                tipoProhibido: "sin-vinculo-dependiente");
            return;
        }

        var perfil = await _dbContext.PerfilesDependientes
            .Where(p => p.Id == perfilId && p.Activo)
            .Select(p => new ObtenerDependienteResponse
            {
                Id = p.Id,
                NombreCompleto = p.NombreCompleto,
                TipoSangre = p.TipoSangre.ToString(),
                CondicionesCronicas = p.CondicionesCronicas,
                AlergiasEstructuradas = p.AlergiasEstructuradas,
                ContactosEmergencia = p.ContactosEmergencia.Select(c => new ContactoEmergenciaDto
                {
                    Nombre = c.Nombre,
                    Relacion = c.Relacion,
                    TelefonoWhatsApp = c.TelefonoWhatsApp
                }).ToList(),
                Version = p.Version,
                RolEnDependiente = vinculo.RolEnDependiente.ToString(),
                PuedeEditar = vinculo.RolEnDependiente == RolEnDependiente.CuidadorPrincipal
            })
            .FirstOrDefaultAsync(ct);

        if (perfil is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El perfil dependiente no existe o fue desactivado.",
                tipoRecurso: "perfil-dependiente-no-encontrado");
            return;
        }

        await Send.OkAsync(perfil, ct);
    }
}

public class ObtenerDependienteResponse
{
    public Guid Id { get; init; }
    public string NombreCompleto { get; init; } = string.Empty;
    public string TipoSangre { get; init; } = string.Empty;
    public string CondicionesCronicas { get; init; } = string.Empty;
    public List<string> AlergiasEstructuradas { get; init; } = [];
    public List<ContactoEmergenciaDto> ContactosEmergencia { get; init; } = [];
    public uint Version { get; init; }
    public string RolEnDependiente { get; init; } = string.Empty;
    public bool PuedeEditar { get; init; }
}

public class ContactoEmergenciaDto
{
    public string Nombre { get; init; } = string.Empty;
    public string Relacion { get; init; } = string.Empty;
    public string TelefonoWhatsApp { get; init; } = string.Empty;
}
