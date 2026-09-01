using System.Security.Claims;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Usuarios.MiPerfil;

public record CompletarPerfilRequest(string Nombre, string Apellido);

public class CompletarPerfilValidator : Validator<CompletarPerfilRequest>
{
    public CompletarPerfilValidator()
    {
        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("El nombre es requerido.")
            .MinimumLength(2).WithMessage("El nombre debe tener al menos 2 caracteres.")
            .MaximumLength(80).WithMessage("El nombre no puede superar los 80 caracteres.")
            .Matches("^[\\p{L}\\s'-]+$").WithMessage("Solo se permiten letras, espacios, apóstrofes y guiones.");

        RuleFor(x => x.Apellido)
            .NotEmpty().WithMessage("El apellido es requerido.")
            .MinimumLength(2).WithMessage("El apellido debe tener al menos 2 caracteres.")
            .MaximumLength(80).WithMessage("El apellido no puede superar los 80 caracteres.")
            .Matches("^[\\p{L}\\s'-]+$").WithMessage("Solo se permiten letras, espacios, apóstrofes y guiones.");
    }
}

public class CompletarPerfilEndpoint : Endpoint<CompletarPerfilRequest, MiPerfilResponse>
{
    private readonly AppDbContext _dbContext;

    public CompletarPerfilEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Put("/api/usuarios/mi-perfil");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CompletarPerfilRequest req, CancellationToken ct)
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
            .FirstOrDefaultAsync(u => u.Id == usuarioId, ct);

        if (usuario == null)
        {
            AddError("El usuario autenticado no está registrado en el sistema local.");
            ThrowIfAnyErrors();
            return;
        }

        if (usuario.Estado == EstadoUsuario.Activo)
        {
            await Send.ResponseAsync(
                new MiPerfilResponse(
                    usuario.Id,
                    usuario.Correo,
                    usuario.Nombre,
                    usuario.Apellido,
                    usuario.Rol.ToString(),
                    usuario.Estado.ToString()),
                409,
                ct);
            return;
        }

        usuario.Nombre = req.Nombre.Trim();
        usuario.Apellido = req.Apellido.Trim();
        usuario.Estado = EstadoUsuario.Activo;
        usuario.FechaCompletadoPerfil = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

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
