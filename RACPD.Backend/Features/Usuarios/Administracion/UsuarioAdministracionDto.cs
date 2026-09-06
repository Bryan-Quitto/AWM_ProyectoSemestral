using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Usuarios.Administracion;

/// <summary>
/// DTO que devuelve la vista de administración de usuarios.
/// Incluye todos los estados del enum <see cref="EstadoUsuario"/>
/// (incluido <c>Desactivado</c>) para que el administrador tenga
/// visibilidad completa del ciclo de vida de cada cuenta.
/// </summary>
public record UsuarioAdministracionResponse(
    Guid Id,
    string Correo,
    string Nombre,
    string Apellido,
    string Rol,
    string Estado
);

/// <summary>
/// Tipos de cambio de estado permitidos desde el endpoint
/// <c>PATCH /api/usuarios/{id}/estado</c>. NO se permite transicionar
/// a <c>PendienteAceptacion</c> ni a <c>PerfilIncompleto</c> desde aquí;
/// esos estados los gestiona el flujo de invitación.
/// </summary>
public static class EstadosAdministrables
{
    public static readonly EstadoUsuario[] Permitidos =
    {
        EstadoUsuario.Activo,
        EstadoUsuario.Desactivado
    };

    public static bool EsAdministrable(EstadoUsuario estado) =>
        Permitidos.Contains(estado);
}
