using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.PerfilesDependientes.ActualizarPerfilDependiente;

public class ActualizarPerfilDependienteEndpoint : Endpoint<ActualizarPerfilDependienteRequest>
{
    private readonly AppDbContext _dbContext;

    public ActualizarPerfilDependienteEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Put("/api/perfiles-dependientes/{id}");
        Roles(Rol.CuidadorPrincipal.ToString(), Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(ActualizarPerfilDependienteRequest req, CancellationToken ct)
    {
        var userId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (userId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var idRuta) || idRuta != req.Id)
        {
            AddError("El identificador de la ruta no coincide con el identificador del cuerpo de la solicitud.");
            await Send.ErrorsAsync(StatusCodes.Status400BadRequest, ct);
            return;
        }

        // Autorización: solo el cuidador principal del perfil puede editar.
        var esCuidadorDelPerfil = await _dbContext.VinculosDependientes
            .AnyAsync(v => v.UsuarioId == userId.Value
                        && v.PerfilDependienteId == req.Id
                        && v.Activo
                        && v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal, ct);

        if (!esCuidadorDelPerfil)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal del perfil puede editarlo.",
                tipoProhibido: "sin-permiso-edicion-dependiente");
            return;
        }

        var perfil = await _dbContext.PerfilesDependientes
            .Include(p => p.ContactosEmergencia)
            .Where(p => p.Id == req.Id && p.Activo)
            .FirstOrDefaultAsync(ct);

        if (perfil is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El perfil dependiente no existe o fue desactivado.",
                tipoRecurso: "perfil-dependiente-no-encontrado");
            return;
        }

        var tipoSangre = Enum.Parse<TipoSangre>(req.TipoSangre, ignoreCase: false);

        perfil.Actualizar(
            req.NombreCompleto,
            tipoSangre,
            req.CondicionesCronicas,
            req.AlergiasEstructuradas,
            req.ContactosEmergencia.Select(c => new ContactoEmergencia
            {
                Nombre = c.Nombre,
                Relacion = c.Relacion,
                TelefonoWhatsApp = c.TelefonoWhatsApp
            }).ToList()
        );

        _dbContext.Entry(perfil).Property(p => p.Version).OriginalValue = req.Version;

        try
        {
            await _dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            AddError("El perfil fue modificado por otro usuario o proceso. Por favor, recargue la página e intente de nuevo.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }

        await Send.NoContentAsync(ct);
    }
}

public class ActualizarPerfilDependienteRequest
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

public class ActualizarPerfilDependienteValidator : Validator<ActualizarPerfilDependienteRequest>
{
    public ActualizarPerfilDependienteValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("El identificador del perfil es obligatorio.");

        RuleFor(x => x.NombreCompleto)
            .NotEmpty().WithMessage("El nombre completo es obligatorio.")
            .MinimumLength(3).WithMessage("El nombre completo debe tener al menos 3 caracteres.")
            .MaximumLength(200).WithMessage("El nombre completo no puede exceder los 200 caracteres.");

        RuleFor(x => x.TipoSangre)
            .NotEmpty().WithMessage("El tipo de sangre es obligatorio.")
            .IsEnumName(typeof(TipoSangre)).WithMessage("El tipo de sangre proporcionado no es válido.");

        RuleFor(x => x.CondicionesCronicas)
            .MaximumLength(4000).WithMessage("Las condiciones crónicas no pueden exceder los 4000 caracteres.");

        RuleFor(x => x.AlergiasEstructuradas)
            .Must(x => x.Count <= 50).WithMessage("No se pueden registrar más de 50 alergias.");

        RuleForEach(x => x.AlergiasEstructuradas)
            .NotEmpty().WithMessage("Cada alergia no puede estar vacía.")
            .MinimumLength(1).WithMessage("Cada alergia debe contener al menos 1 carácter.")
            .MaximumLength(100).WithMessage("Cada alergia no puede exceder los 100 caracteres.");

        RuleForEach(x => x.ContactosEmergencia).ChildRules(contactos => {
            contactos.RuleFor(c => c.Nombre)
                .NotEmpty().WithMessage("El nombre del contacto de emergencia es obligatorio.")
                .MinimumLength(2).WithMessage("El nombre del contacto debe tener al menos 2 caracteres.")
                .MaximumLength(200).WithMessage("El nombre del contacto no puede exceder los 200 caracteres.");

            contactos.RuleFor(c => c.Relacion)
                .NotEmpty().WithMessage("La relación con el contacto es obligatoria.")
                .MinimumLength(2).WithMessage("La relación debe tener al menos 2 caracteres.")
                .MaximumLength(100).WithMessage("La relación no puede exceder los 100 caracteres.");

            contactos.RuleFor(c => c.TelefonoWhatsApp)
                .NotEmpty().WithMessage("El teléfono de WhatsApp es obligatorio.")
                .Matches(@"^\+593\d{9}$").WithMessage("Debe ser un número de Ecuador válido (+593...)");
        });

        RuleFor(x => x.ContactosEmergencia)
            .Must(x => x.Count <= 3).WithMessage("Máximo 3 contactos de emergencia");

        RuleFor(x => x.Version)
            .NotNull().WithMessage("La versión de concurrencia es obligatoria.");
    }
}
