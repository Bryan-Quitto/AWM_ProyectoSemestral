using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Usuarios.Administracion.CambiarEstado;

/// <summary>
/// Body del endpoint. El string se valida contra
/// <see cref="EstadosAdministrables"/>; cualquier valor fuera de
/// <c>Activo</c> o <c>Desactivado</c> se rechaza con 400.
/// </summary>
public record CambiarEstadoRequest(string Estado);

public class CambiarEstadoValidator : Validator<CambiarEstadoRequest>
{
    public CambiarEstadoValidator()
    {
        RuleFor(x => x.Estado)
            .NotEmpty().WithMessage("El estado es requerido.")
            .Must(s => EstadosAdministrables.EsAdministrable(
                Enum.Parse<EstadoUsuario>(s, ignoreCase: false)))
            .WithMessage("Solo se permiten los estados 'Activo' o 'Desactivado'.");
    }
}

/// <summary>
/// Activa o desactiva una cuenta de usuario. Acceso exclusivo para
/// <see cref="Rol.AdministradorSistema"/>.
///
/// Reglas de negocio:
/// 1. NO se permite desactivar la propia cuenta del solicitante.
/// 2. NO se permite desactivar al ÚNICO
///    <see cref="Rol.AdministradorSistema"/> activo
///    (debe existir ≥ 1 admin que pueda gestionar la plataforma).
/// 3. Idempotente: si ya está en el estado solicitado, devuelve 200 sin tocar la fila.
/// </summary>
public class CambiarEstadoEndpoint : Endpoint<CambiarEstadoRequest, UsuarioAdministracionResponse>
{
    private readonly AppDbContext _dbContext;

    public CambiarEstadoEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Patch("/api/usuarios/{id}/estado");
        Roles(Rol.AdministradorSistema.ToString());
    }

    public override async Task HandleAsync(CambiarEstadoRequest req, CancellationToken ct)
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

        EstadoUsuario estadoSolicitado;
        try
        {
            estadoSolicitado = Enum.Parse<EstadoUsuario>(req.Estado, ignoreCase: false);
        }
        catch (ArgumentException)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["estado"] = new[] { "Solo se permiten los estados 'Activo' o 'Desactivado'." }
                },
                "Estado no válido.");
            return;
        }

        if (!EstadosAdministrables.EsAdministrable(estadoSolicitado))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["estado"] = new[] { "Solo se permiten los estados 'Activo' o 'Desactivado'." }
                },
                "Estado no administrable desde este endpoint.");
            return;
        }

        // Regla 1: no desactivarse a sí mismo.
        if (usuarioIdObjetivo == solicitanteId.Value
            && estadoSolicitado == EstadoUsuario.Desactivado)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "No puedes desactivar tu propia cuenta.",
                tipoProhibido: "no-puede-desactivarse-a-si-mismo");
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

        // Idempotencia: si ya está en el estado solicitado, devolvemos el DTO sin cambios.
        if (usuarioObjetivo.Estado == estadoSolicitado)
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

        // Regla 2: si vamos a desactivar a un AdministradorSistema activo,
        // verificar que no sea el último admin activo.
        if (usuarioObjetivo.Rol == Rol.AdministradorSistema
            && usuarioObjetivo.Estado == EstadoUsuario.Activo
            && estadoSolicitado == EstadoUsuario.Desactivado)
        {
            var cantidadAdminsActivos = await _dbContext.Usuarios
                .CountAsync(u => u.Rol == Rol.AdministradorSistema
                              && u.Estado == EstadoUsuario.Activo
                              && u.Id != usuarioIdObjetivo, ct);

            if (cantidadAdminsActivos == 0)
            {
                await ProblemDetailsHelper.EnviarConflictoAsync(
                    HttpContext,
                    "No se puede desactivar al único Administrador del Sistema activo. " +
                    "Primero active a otro usuario como Administrador del Sistema.",
                    tipoConflicto: "ultimo-administrador");
                return;
            }
        }

        usuarioObjetivo.Estado = estadoSolicitado;
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
