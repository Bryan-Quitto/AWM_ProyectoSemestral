using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Usuarios.Administracion.CambiarRol;

public record CambiarRolRequest(Rol Rol);

public class CambiarRolValidator : Validator<CambiarRolRequest>
{
    public CambiarRolValidator()
    {
        RuleFor(x => x.Rol)
            .IsInEnum()
            .WithMessage("El rol seleccionado no es válido.");
    }
}

/// <summary>
/// Cambia el rol de un usuario. Acceso exclusivo para
/// <see cref="Rol.AdministradorSistema"/>.
///
/// Reglas de negocio:
/// 1. NO se permite modificar el rol del propio usuario autenticado
///    (consistencia: debe existir al menos 1 admin que sepa que lo es).
/// 2. NO se permite degradar al ÚNICO
///    <see cref="Rol.AdministradorSistema"/> activo a otro rol
///    (regla de negocio: debe existir ≥ 1 admin operativo).
/// </summary>
public class CambiarRolEndpoint : Endpoint<CambiarRolRequest, UsuarioAdministracionResponse>
{
    private readonly AppDbContext _dbContext;

    public CambiarRolEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Patch("/api/usuarios/{id}/rol");
        Roles(Rol.AdministradorSistema.ToString());
    }

    public override async Task HandleAsync(CambiarRolRequest req, CancellationToken ct)
    {
        var solicitanteId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (solicitanteId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var usuarioIdObjetivo))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["id"] = new[] { "El identificador del usuario debe ser un Guid válido." }
                },
                "Identificador inválido.");
            return;
        }

        // Regla 1: no modificarse a sí mismo.
        if (usuarioIdObjetivo == solicitanteId.Value)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "No puedes modificar tu propio rol.",
                tipoProhibido: "no-puede-modificar-su-propio-rol");
            return;
        }

        var usuarioObjetivo = await _dbContext.Usuarios
            .FirstOrDefaultAsync(u => u.Id == usuarioIdObjetivo, ct);

        if (usuarioObjetivo is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El usuario objetivo no existe.",
                tipoRecurso: "usuario-no-encontrado");
            return;
        }

        // Idempotencia: si ya tiene ese rol, devolvemos el DTO sin cambios.
        if (usuarioObjetivo.Rol == req.Rol)
        {
            await Send.OkAsync(
                new UsuarioAdministracionResponse(
                    usuarioObjetivo.Id,
                    usuarioObjetivo.Correo,
                    usuarioObjetivo.Nombre,
                    usuarioObjetivo.Apellido,
                    usuarioObjetivo.Rol.ToString(),
                    usuarioObjetivo.Estado.ToString()),
                ct);
            return;
        }

        // Regla 2: si el objetivo ERA AdministradorSistema y se quiere
        // degradar, verificar que no sea el último admin ACTIVO.
        if (usuarioObjetivo.Rol == Rol.AdministradorSistema
            && req.Rol != Rol.AdministradorSistema
            && usuarioObjetivo.Estado == EstadoUsuario.Activo)
        {
            var cantidadAdminsActivos = await _dbContext.Usuarios
                .CountAsync(u => u.Rol == Rol.AdministradorSistema
                              && u.Estado == EstadoUsuario.Activo
                              && u.Id != usuarioIdObjetivo, ct);

            if (cantidadAdminsActivos == 0)
            {
                await ProblemDetailsHelper.EnviarConflictoAsync(
                    HttpContext,
                    "No se puede degradar al único Administrador del Sistema activo. " +
                    "Primero active a otro usuario como Administrador del Sistema.",
                    tipoConflicto: "ultimo-administrador");
                return;
            }
        }

        usuarioObjetivo.Rol = req.Rol;
        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(
            new UsuarioAdministracionResponse(
                usuarioObjetivo.Id,
                usuarioObjetivo.Correo,
                usuarioObjetivo.Nombre,
                usuarioObjetivo.Apellido,
                usuarioObjetivo.Rol.ToString(),
                usuarioObjetivo.Estado.ToString()),
            ct);
    }
}
