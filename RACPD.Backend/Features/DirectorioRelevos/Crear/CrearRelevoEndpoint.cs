using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.DirectorioRelevos.Crear;

/// <summary>
/// Endpoint POST /api/directorio-relevos — crea una entrada en el Directorio
/// de Relevos para un dependiente específico, seleccionando un Usuario de
/// Apoyo existente.
///
/// Tenancy clínica: solo el <c>CuidadorPrincipal</c> del
/// <c>PerfilDependiente</c> puede crear relevos (REGLA-AHA-UI: nunca delegar
/// la gestión del directorio a otros roles).
///
/// Reglas duras:
/// - El <c>PerfilDependiente</c> debe existir y estar activo.
/// - El <c>UsuarioApoyo</c> debe existir, tener <c>Rol.Apoyo</c> y estar
///   <c>Activo</c> en el sistema.
/// - No puede haber dos relevos activos del mismo par
///   (perfilDependienteId, usuarioApoyoId) (índice único parcial ya lo
///   enforza, pero respondemos 409 antes para un mejor DX).
/// - <c>Nombre</c>: 1..150 chars.
/// - <c>Telefono</c>: 1..20 chars (validación de formato EC se hace en cliente).
/// - <c>Estado</c>: opcional, default <c>Disponible</c>.
///
/// Errores: RFC 7807 via <see cref="ProblemDetailsHelper"/>.
/// </summary>
public class CrearRelevoEndpoint : Endpoint<CrearRelevoRequest, RelevoItemResponse>
{
    private readonly AppDbContext _db;

    public CrearRelevoEndpoint(AppDbContext db)
    {
        _db = db;
    }

    public override void Configure()
    {
        Post("/api/directorio-relevos");
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(CrearRelevoRequest req, CancellationToken ct)
    {
        var usuarioActualId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioActualId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // === Validación 1: PerfilDependiente existe y activo ===
        var perfilActivo = await _db.PerfilesDependientes
            .AsNoTracking()
            .AnyAsync(p => p.Id == req.PerfilDependienteId && p.Activo, ct);
        if (!perfilActivo)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El perfil dependiente no existe o no está activo.",
                tipoRecurso: "perfil-dependiente-no-encontrado");
            return;
        }

        // === Validación 2: tenancy clínica ===
        // El usuario actual debe ser CuidadorPrincipal del dependiente.
        var esPrincipalDelDependiente = await _db.VinculosDependientes
            .AsNoTracking()
            .AnyAsync(v =>
                v.UsuarioId == usuarioActualId.Value &&
                v.PerfilDependienteId == req.PerfilDependienteId &&
                v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal &&
                v.Activo, ct);
        if (!esPrincipalDelDependiente)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal de este dependiente puede agregar relevos.",
                tipoProhibido: "dependiente-no-autorizado");
            return;
        }

        // === Validación 3: UsuarioApoyo válido ===
        var usuarioApoyo = await _db.Usuarios
            .AsNoTracking()
            .Where(u => u.Id == req.UsuarioApoyoId)
            .Select(u => new { u.Id, u.Rol, u.Estado, u.Nombre, u.Apellido, u.Correo })
            .FirstOrDefaultAsync(ct);
        if (usuarioApoyo is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El usuario de apoyo no existe.",
                tipoRecurso: "usuario-apoyo-no-encontrado");
            return;
        }
        if (usuarioApoyo.Rol != Rol.Apoyo)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["usuarioApoyoId"] = new[]
                    {
                        $"El usuario seleccionado no tiene el rol {Rol.Apoyo}."
                    }
                },
                $"El usuario no tiene el rol {Rol.Apoyo} requerido.",
                titulo: "Rol de usuario inválido");
            return;
        }
        if (usuarioApoyo.Estado != EstadoUsuario.Activo)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "El usuario de apoyo seleccionado no está activo en el sistema.",
                tipoConflicto: "usuario-apoyo-inactivo");
            return;
        }

        // === Validación 4: unicidad (perfil, usuario) ===
        var yaExiste = await _db.DirectorioRelevos
            .AsNoTracking()
            .AnyAsync(d =>
                d.PerfilDependienteId == req.PerfilDependienteId &&
                d.UsuarioApoyoId == req.UsuarioApoyoId &&
                d.Activo, ct);
        if (yaExiste)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Ya existe un relevo activo para este dependiente y usuario de apoyo.",
                tipoConflicto: "relevo-duplicado");
            return;
        }

        // === Creación ===
        var relevo = new DirectorioRelevo
        {
            Id = Guid.NewGuid(),
            PerfilDependienteId = req.PerfilDependienteId,
            UsuarioApoyoId = req.UsuarioApoyoId,
            Nombre = req.Nombre.Trim(),
            Telefono = req.Telefono.Trim(),
            Estado = req.Estado ?? EstadoDirectorioRelevo.Disponible,
            Notas = string.IsNullOrWhiteSpace(req.Notas) ? null : req.Notas.Trim(),
            Listado = req.Listado ?? true,
            Activo = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _db.DirectorioRelevos.Add(relevo);
        await _db.SaveChangesAsync(ct);

        // Cargamos el nombre del dependiente para devolverlo en la respuesta
        // (consistencia con el GET Listar).
        var dependienteNombre = await _db.PerfilesDependientes
            .AsNoTracking()
            .Where(p => p.Id == relevo.PerfilDependienteId)
            .Select(p => p.NombreCompleto)
            .FirstOrDefaultAsync(ct) ?? string.Empty;

        var respuesta = new RelevoItemResponse(
            Id: relevo.Id,
            Nombre: relevo.Nombre,
            Telefono: relevo.Telefono,
            Estado: relevo.Estado,
            PerfilDependienteId: relevo.PerfilDependienteId,
            DependienteNombre: dependienteNombre);
        await Send.OkAsync(respuesta, ct);
    }
}

/// <summary>
/// Response para la creación de un relevo.
/// Réplica local del DTO de <c>ListarDirectorioRelevosEndpoint</c> para
/// evitar el acoplamiento entre features. Si en el futuro se quiere
/// compartir, mover a un archivo de DTOs común.
/// </summary>
public record RelevoItemResponse(
    Guid Id,
    string Nombre,
    string Telefono,
    EstadoDirectorioRelevo Estado,
    Guid PerfilDependienteId,
    string DependienteNombre
);

/// <summary>
/// Request para crear un relevo.
/// </summary>
public class CrearRelevoRequest
{
    /// <summary>FK al PerfilDependiente donde se agrega el relevo.</summary>
    public Guid PerfilDependienteId { get; set; }

    /// <summary>FK al Usuario con Rol.Apoyo que se vincula al directorio.</summary>
    public Guid UsuarioApoyoId { get; set; }

    /// <summary>Nombre a mostrar (alias del cuidador para esta familia).</summary>
    public string Nombre { get; set; } = string.Empty;

    /// <summary>Teléfono Ecuador (E.164 +5939XXXXXXXX o local 09XXXXXXXX).</summary>
    public string Telefono { get; set; } = string.Empty;

    /// <summary>Estado inicial del relevo. Default Disponible si no se envía.</summary>
    public EstadoDirectorioRelevo? Estado { get; set; }

    /// <summary>Notas privadas del cuidador principal (opcional).</summary>
    public string? Notas { get; set; }

    /// <summary>Si el relevo debe aparecer listado. Default true.</summary>
    public bool? Listado { get; set; }
}
