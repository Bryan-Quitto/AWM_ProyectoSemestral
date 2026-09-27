using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.DirectorioRelevos.Editar;

/// <summary>
/// Endpoint PUT /api/directorio-relevos/{id} — edita un relevo existente.
///
/// Tenancy clínica: solo el <c>CuidadorPrincipal</c> del
/// <c>PerfilDependiente</c> asociado al relevo puede editarlo. Esta
/// coherencia con <c>CrearRelevoEndpoint</c> evita escaladas de
/// privilegio entre cuidadores de apoyo.
///
/// Reglas:
/// - El relevo debe existir (404 si no).
/// - El usuario actual debe ser CuidadorPrincipal del PerfilDependiente
///   del relevo (403 si no).
/// - Campos editables: <c>Nombre</c>, <c>Telefono</c>, <c>Estado</c>,
///   <c>Notas</c>, <c>Listado</c>. NO se permite cambiar
///   <c>PerfilDependienteId</c> ni <c>UsuarioApoyoId</c> vía este endpoint:
///   eso es una creación/eliminación semántica.
/// - Si el relevo está marcado Activo=false (soft-deleted), se devuelve
///   404 para no exponer entradas borradas.
///
/// Errores: RFC 7807 via <see cref="ProblemDetailsHelper"/>.
/// </summary>
public class EditarRelevoEndpoint : Endpoint<EditarRelevoRequest, RelevoItemResponse>
{
    private readonly AppDbContext _db;

    public EditarRelevoEndpoint(AppDbContext db)
    {
        _db = db;
    }

    public override void Configure()
    {
        Put("/api/directorio-relevos/{id}");
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(EditarRelevoRequest req, CancellationToken ct)
    {
        var usuarioActualId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioActualId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        if (!Guid.TryParse(req.Id, out var relevoId))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["id"] = new[] { "El ID del relevo no es válido." }
                },
                "El identificador del relevo es inválido.");
            return;
        }

        // Cargamos el relevo sin tracking para validar tenancy primero.
        var relevo = await _db.DirectorioRelevos
            .FirstOrDefaultAsync(d => d.Id == relevoId && d.Activo, ct);
        if (relevo is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El relevo no existe o fue eliminado.",
                tipoRecurso: "relevo-no-encontrado");
            return;
        }

        // === Tenancy: el usuario actual debe ser Principal del dependiente ===
        var esPrincipalDelDependiente = await _db.VinculosDependientes
            .AsNoTracking()
            .AnyAsync(v =>
                v.UsuarioId == usuarioActualId.Value &&
                v.PerfilDependienteId == relevo.PerfilDependienteId &&
                v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal &&
                v.Activo, ct);
        if (!esPrincipalDelDependiente)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal de este dependiente puede editar el relevo.",
                tipoProhibido: "dependiente-no-autorizado");
            return;
        }

        // === Aplicar cambios editables ===
        if (!string.IsNullOrWhiteSpace(req.Nombre))
        {
            relevo.Nombre = req.Nombre.Trim();
        }
        if (!string.IsNullOrWhiteSpace(req.Telefono))
        {
            relevo.Telefono = req.Telefono.Trim();
        }
        if (req.Estado.HasValue)
        {
            relevo.Estado = req.Estado.Value;
        }
        // Notas: explícitamente nullable. Si el cliente envía "" se trata como null.
        if (req.Notas != null)
        {
            relevo.Notas = string.IsNullOrWhiteSpace(req.Notas) ? null : req.Notas.Trim();
        }
        if (req.Listado.HasValue)
        {
            relevo.Listado = req.Listado.Value;
        }
        relevo.UpdatedAt = DateTimeOffset.UtcNow;

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
/// Request para editar un relevo. Todos los campos son opcionales:
/// solo se aplican los que se envían (PATCH-like semantics sobre PUT).
/// </summary>
public class EditarRelevoRequest
{
    /// <summary>ID del relevo (path segment).</summary>
    public string Id { get; set; } = default!;

    /// <summary>Nuevo nombre a mostrar (opcional).</summary>
    public string? Nombre { get; set; }

    /// <summary>Nuevo teléfono (opcional).</summary>
    public string? Telefono { get; set; }

    /// <summary>Nuevo estado del directorio (opcional).</summary>
    public EstadoDirectorioRelevo? Estado { get; set; }

    /// <summary>Nuevas notas. Vacío = limpiar. Null = no tocar.</summary>
    public string? Notas { get; set; }

    /// <summary>Nuevo flag de listado (opcional).</summary>
    public bool? Listado { get; set; }
}

/// <summary>
/// Response para la edición de un relevo. Réplica local del DTO de
/// <c>ListarDirectorioRelevosEndpoint</c> para evitar el acoplamiento entre
/// features.
/// </summary>
public record RelevoItemResponse(
    Guid Id,
    string Nombre,
    string Telefono,
    EstadoDirectorioRelevo Estado,
    Guid PerfilDependienteId,
    string DependienteNombre
);
