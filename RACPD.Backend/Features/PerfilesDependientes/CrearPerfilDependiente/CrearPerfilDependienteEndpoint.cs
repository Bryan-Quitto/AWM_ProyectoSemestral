using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;
using System.Security.Claims;

namespace RACPD.Backend.Features.PerfilesDependientes.CrearPerfilDependiente;

public class CrearPerfilDependienteEndpoint : Endpoint<CrearPerfilDependienteRequest, Guid>
{
    private readonly AppDbContext _dbContext;

    public CrearPerfilDependienteEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/perfiles-dependientes");
        // Solo el cuidador principal GLOBAL puede crear perfiles dependientes.
        // Un Apoyo NO puede crear un perfil (decisión de producto).
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(CrearPerfilDependienteRequest req, CancellationToken ct)
    {
        var userId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (userId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        var tipoSangre = Enum.Parse<TipoSangre>(req.TipoSangre, ignoreCase: false);

        var perfil = new PerfilDependiente(
            userId.Value,
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

        _dbContext.PerfilesDependientes.Add(perfil);

        // Crear el vínculo automático del creador como CuidadorPrincipal del perfil.
        var vinculo = new VinculoDependiente(
            userId.Value,
            perfil.Id,
            RolEnDependiente.CuidadorPrincipal,
            asignadoPorUsuarioId: userId.Value);
        _dbContext.VinculosDependientes.Add(vinculo);

        await _dbContext.SaveChangesAsync(ct);

        HttpContext.Response.Headers.Location = $"/api/perfiles-dependientes/{perfil.Id}";
        await Send.ResponseAsync(perfil.Id, StatusCodes.Status201Created, ct);
    }
}

public class CrearPerfilDependienteRequest
{
    public string NombreCompleto { get; init; } = string.Empty;
    public string TipoSangre { get; init; } = string.Empty;
    public string CondicionesCronicas { get; init; } = string.Empty;
    public List<string> AlergiasEstructuradas { get; init; } = [];
    public List<ContactoEmergenciaDto> ContactosEmergencia { get; init; } = [];
}

public class ContactoEmergenciaDto
{
    public string Nombre { get; init; } = string.Empty;
    public string Relacion { get; init; } = string.Empty;
    public string TelefonoWhatsApp { get; init; } = string.Empty;
}

public class CrearPerfilDependienteValidator : Validator<CrearPerfilDependienteRequest>
{
    public CrearPerfilDependienteValidator()
    {
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
    }
}
