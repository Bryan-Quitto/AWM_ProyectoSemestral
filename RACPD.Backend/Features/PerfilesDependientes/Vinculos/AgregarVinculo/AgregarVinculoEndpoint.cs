using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.Vinculos.AgregarVinculo;

/// <summary>
/// Crea un nuevo vínculo entre un usuario y un perfil dependiente.
/// Solo el cuidador principal del perfil puede invocar este endpoint.
///
/// Reglas de unicidad enforced:
/// - Índice único activo (UsuarioId, PerfilDependienteId): no duplicados.
/// - Índice único parcial (PerfilDependienteId) cuando Rol = CuidadorPrincipal:
///   máximo un cuidador principal activo por perfil.
/// </summary>
public class AgregarVinculoEndpoint : Endpoint<AgregarVinculoRequest, Guid>
{
    private readonly AppDbContext _dbContext;

    public AgregarVinculoEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/perfiles-dependientes/{id}/vinculos");
        Roles(Rol.CuidadorPrincipal.ToString(), Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(AgregarVinculoRequest req, CancellationToken ct)
    {
        var userId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (userId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var perfilId) || perfilId != req.PerfilDependienteId)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["perfilDependienteId"] = new[] { "El identificador del perfil de la ruta no coincide con el del cuerpo." }
                },
                "Identificador inválido.");
            return;
        }

        // Solo el cuidador principal del perfil puede agregar vínculos.
        var esCuidadorDelPerfil = await _dbContext.VinculosDependientes
            .AnyAsync(v => v.UsuarioId == userId.Value
                        && v.PerfilDependienteId == perfilId
                        && v.Activo
                        && v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal, ct);

        if (!esCuidadorDelPerfil)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal del perfil puede agregar vínculos.",
                tipoProhibido: "sin-permiso-gestionar-vinculos");
            return;
        }

        var perfilActivo = await _dbContext.PerfilesDependientes
            .AnyAsync(p => p.Id == perfilId && p.Activo, ct);

        if (!perfilActivo)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El perfil dependiente no existe o fue desactivado.",
                tipoRecurso: "perfil-dependiente-no-encontrado");
            return;
        }

        var usuarioObjetivo = await _dbContext.Usuarios
            .FirstOrDefaultAsync(u => u.Id == req.UsuarioId, ct);

        if (usuarioObjetivo is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El usuario que intenta vincular no existe en el sistema.",
                tipoRecurso: "usuario-no-encontrado");
            return;
        }

        // Validación de unicidad (también enforced por BD, pero damos un mensaje más claro).
        var yaExiste = await _dbContext.VinculosDependientes
            .AnyAsync(v => v.UsuarioId == req.UsuarioId
                        && v.PerfilDependienteId == perfilId
                        && v.Activo, ct);

        if (yaExiste)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Este usuario ya tiene un vínculo activo con este perfil dependiente.",
                tipoConflicto: "vinculo-ya-existe");
            return;
        }

        var rolEnDependiente = Enum.Parse<RolEnDependiente>(req.RolEnDependiente, ignoreCase: false);

        // Re-check de unicidad sobre el enum ya parseado (la validación previa
        // comparaba el string crudo del request).
        if (rolEnDependiente == RolEnDependiente.CuidadorPrincipal)
        {
            var existeOtroCuidador = await _dbContext.VinculosDependientes
                .AnyAsync(v => v.PerfilDependienteId == perfilId
                            && v.Activo
                            && v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal, ct);

            if (existeOtroCuidador)
            {
                await ProblemDetailsHelper.EnviarConflictoAsync(
                    HttpContext,
                    "Este perfil ya tiene un cuidador principal activo. Para transferir el cuidado, primero desactive el vínculo actual.",
                    tipoConflicto: "ya-existe-cuidador-principal");
                return;
            }
        }

        var vinculo = new VinculoDependiente(
            req.UsuarioId,
            perfilId,
            rolEnDependiente,
            asignadoPorUsuarioId: userId.Value);

        _dbContext.VinculosDependientes.Add(vinculo);

        try
        {
            await _dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("IX_VinculosDependientes_UnSoloCuidadorPrincipalActivo") == true)
        {
            // Respaldo por si el orden de checks en BD detecta la duplicidad.
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Este perfil ya tiene un cuidador principal activo. Para transferir el cuidado, primero desactive el vínculo actual.",
                tipoConflicto: "ya-existe-cuidador-principal");
            return;
        }

        HttpContext.Response.Headers.Location = $"/api/perfiles-dependientes/{perfilId}/vinculos/{vinculo.Id}";
        await Send.ResponseAsync(vinculo.Id, StatusCodes.Status201Created, ct);
    }
}

public class AgregarVinculoRequest
{
    public Guid PerfilDependienteId { get; init; }
    public Guid UsuarioId { get; init; }
    public string RolEnDependiente { get; init; } = string.Empty;
}

public class AgregarVinculoValidator : Validator<AgregarVinculoRequest>
{
    public AgregarVinculoValidator()
    {
        RuleFor(x => x.PerfilDependienteId)
            .NotEmpty().WithMessage("El identificador del perfil dependiente es obligatorio.");

        RuleFor(x => x.UsuarioId)
            .NotEmpty().WithMessage("El identificador del usuario es obligatorio.");

        RuleFor(x => x.RolEnDependiente)
            .NotEmpty().WithMessage("El rol en el dependiente es obligatorio.")
            .IsEnumName(typeof(RolEnDependiente)).WithMessage("El rol proporcionado no es válido.");
    }
}
