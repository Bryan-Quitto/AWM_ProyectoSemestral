using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using System.Security.Claims;

namespace RACPD.Backend.Features.PerfilesDependientes.ObtenerMiDependiente;

public class ObtenerMiDependienteEndpoint : EndpointWithoutRequest<ObtenerMiDependienteResponse>
{
    private readonly AppDbContext _dbContext;

    public ObtenerMiDependienteEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/perfiles-dependientes/mi-dependiente");
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            AddError("No se pudo identificar al usuario autenticado.");
            ThrowIfAnyErrors();
            return;
        }

        var perfil = await _dbContext.PerfilesDependientes
            .Where(p => p.CuidadorPrincipalId == userId)
            .Select(p => new ObtenerMiDependienteResponse
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
                Version = p.Version
            })
            .FirstOrDefaultAsync(ct);

        if (perfil is null)
        {
            AddError("No se ha encontrado un perfil dependiente asociado a su identificador de cuidador.");
            await Send.ErrorsAsync(StatusCodes.Status404NotFound, ct);
            return;
        }

        await Send.OkAsync(perfil, ct);
    }
}

public class ObtenerMiDependienteResponse
{
    public Guid Id { get; init; }
    public string NombreCompleto { get; init; } = string.Empty;
    public string TipoSangre { get; init; } = string.Empty;
    public string CondicionesCronicas { get; init; } = string.Empty;
    public List<string> AlergiasEstructuradas { get; init; } = [];
    public List<ContactoEmergenciaDto> ContactosEmergencia { get; init; } = [];
    public uint Version { get; init; }
}

public class ContactoEmergenciaDto
{
    public string Nombre { get; init; } = string.Empty;
    public string Relacion { get; init; } = string.Empty;
    public string TelefonoWhatsApp { get; init; } = string.Empty;
}
