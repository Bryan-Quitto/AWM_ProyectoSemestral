using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Usuarios.MiPerfil;

public record MiPerfilResponse(
    Guid Id,
    string Correo,
    string Nombre,
    string Apellido,
    string Rol,
    string Estado
);

public class ObtenerMiPerfilEndpoint : EndpointWithoutRequest<MiPerfilResponse>
{
    private readonly AppDbContext _dbContext;

    public ObtenerMiPerfilEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/usuarios/mi-perfil");
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
            AddError("No se pudo identificar al usuario autenticado.");
            ThrowIfAnyErrors();
            return;
        }

        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId, ct);

        if (usuario == null)
        {
            AddError("El usuario autenticado no está registrado en el sistema local.");
            ThrowIfAnyErrors();
            return;
        }

        await Send.OkAsync(
            new MiPerfilResponse(
                usuario.Id,
                usuario.Correo,
                usuario.Nombre,
                usuario.Apellido,
                usuario.Rol.ToString(),
                usuario.Estado.ToString()),
            ct);
    }
}
