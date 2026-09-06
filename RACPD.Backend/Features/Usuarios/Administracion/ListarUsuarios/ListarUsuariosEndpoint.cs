using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Usuarios.Administracion.ListarUsuarios;

/// <summary>
/// Lista TODOS los usuarios del sistema sin importar su estado
/// (<c>PendienteAceptacion</c>, <c>PerfilIncompleto</c>, <c>Activo</c>,
/// <c>Desactivado</c>). Acceso exclusivo para
/// <see cref="Rol.AdministradorSistema"/>.
///
/// El ordenamiento es por apellido y luego nombre para que la lista
/// sea predecible en la UI. El frontend se encarga de la búsqueda y
/// el filtrado cliente (Zero-Wait Policy).
/// </summary>
public class ListarUsuariosEndpoint : EndpointWithoutRequest<List<UsuarioAdministracionResponse>>
{
    private readonly AppDbContext _dbContext;

    public ListarUsuariosEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/usuarios");
        Roles(Rol.AdministradorSistema.ToString());
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
            .AsNoTracking()
            .OrderBy(u => u.Apellido)
            .ThenBy(u => u.Nombre)
            .Select(u => new UsuarioAdministracionResponse(
                u.Id,
                u.Correo,
                u.Nombre,
                u.Apellido,
                u.Rol.ToString(),
                u.Estado.ToString()))
            .ToListAsync(ct);

        await Send.OkAsync(usuarios, ct);
    }
}
