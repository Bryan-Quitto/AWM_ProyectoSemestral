using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Usuarios.UsuariosDeApoyo.ListarUsuariosDeApoyo;

/// <summary>
/// Lista todos los usuarios del sistema con rol <see cref="Rol.Apoyo"/> y estado
/// <see cref="EstadoUsuario.Activo"/>. Pensado para alimentar el selector con
/// búsqueda fuzzy del frontend (BuscadorDinamico) en la sección "Personas con acceso".
///
/// Solo accesible para <see cref="Rol.CuidadorPrincipal"/>.
/// Devuelve los campos mínimos necesarios para mostrar al cuidador principal
/// a quién puede agregar como Apoyo de un perfil dependiente:
/// - UsuarioId
/// - NombreCompleto (Nombre + " " + Apellido)
/// - Correo
///
/// No expone roles, estados ni datos sensibles.
/// </summary>
public class ListarUsuariosDeApoyoEndpoint : EndpointWithoutRequest<List<UsuarioApoyoResponse>>
{
    private readonly AppDbContext _dbContext;

    public ListarUsuariosDeApoyoEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/usuarios-de-apoyo");
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (userId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        var usuarios = await _dbContext.Usuarios
            .Where(u => u.Rol == Rol.Apoyo && u.Estado == EstadoUsuario.Activo)
            .OrderBy(u => u.Apellido)
            .ThenBy(u => u.Nombre)
            .Select(u => new UsuarioApoyoResponse
            {
                UsuarioId = u.Id,
                NombreCompleto = (u.Nombre + " " + u.Apellido).Trim(),
                Correo = u.Correo,
            })
            .ToListAsync(ct);

        await Send.OkAsync(usuarios, ct);
    }
}

public class UsuarioApoyoResponse
{
    public Guid UsuarioId { get; init; }
    public string NombreCompleto { get; init; } = string.Empty;
    public string Correo { get; init; } = string.Empty;
}