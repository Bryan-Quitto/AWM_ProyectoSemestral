using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.DirectorioRelevos.Eliminar;

/// <summary>
/// Endpoint DELETE /api/directorio-relevos/{id} — soft-delete de un relevo.
///
/// Tenancy clínica: solo el <c>CuidadorPrincipal</c> del
/// <c>PerfilDependiente</c> asociado puede eliminar un relevo. Coherente
/// con <c>CrearRelevoEndpoint</c> y <c>EditarRelevoEndpoint</c>.
///
/// Soft-delete: en lugar de borrar físicamente la fila (lo que rompería
/// trazabilidad clínica y la integridad referencial con
/// <c>Reservas</c>), marcamos <c>Activo = false</c> y dejamos
/// <c>UpdatedAt</c> como sello de auditoría. El listado filtra por
/// <c>Activo = true</c> y el endpoint responde 404 si ya estaba inactivo.
///
/// Reglas:
/// - 401 si no hay sesión.
/// - 404 si el ID no es un Guid válido, si el relevo no existe, o si
///   ya estaba marcado como inactivo.
/// - 403 si el usuario actual no es <c>CuidadorPrincipal</c> del
///   <c>PerfilDependiente</c> del relevo.
/// - Idempotencia: una segunda eliminación del mismo relevo devuelve 404.
///
/// Errores: RFC 7807 via <see cref="ProblemDetailsHelper"/>.
/// </summary>
public class EliminarRelevoEndpoint : EndpointWithoutRequest
{
    private readonly AppDbContext _db;

    public EliminarRelevoEndpoint(AppDbContext db)
    {
        _db = db;
    }

    public override void Configure()
    {
        Delete("/api/directorio-relevos/{id}");
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var usuarioActualId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioActualId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // El binding del parámetro `id` de la ruta.
        var idParam = Route<string>("id");
        if (!Guid.TryParse(idParam, out var relevoId))
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

        // Cargamos el relevo solo si está Activo. La segunda eliminación
        // del mismo ID caerá en el 404.
        var relevo = await _db.DirectorioRelevos
            .FirstOrDefaultAsync(d => d.Id == relevoId && d.Activo, ct);
        if (relevo is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El relevo no existe o ya fue eliminado.",
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
                "Solo el cuidador principal de este dependiente puede eliminar el relevo.",
                tipoProhibido: "dependiente-no-autorizado");
            return;
        }

        // Soft-delete: marcar inactivo y actualizar timestamp.
        relevo.Activo = false;
        relevo.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        // 204 No Content — convención REST para DELETE exitoso.
        await Send.NoContentAsync(ct);
    }
}
