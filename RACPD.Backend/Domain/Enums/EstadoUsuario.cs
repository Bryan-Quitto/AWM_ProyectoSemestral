namespace RACPD.Backend.Domain.Enums;

/// <summary>
/// Estado del ciclo de vida de un usuario en la plataforma.
/// - <c>PendienteAceptacion</c>: invitado por correo, aún no aceptó la invitación.
/// - <c>PerfilIncompleto</c>: aceptó invitación pero no terminó de registrar sus datos.
/// - <c>Activo</c>: cuenta operativa, puede iniciar sesión.
/// - <c>Desactivado</c>: cuenta bloqueada por el AdministradorSistema.
///   No puede iniciar sesión aunque las credenciales sean válidas en Supabase Auth.
/// </summary>
public enum EstadoUsuario
{
    PendienteAceptacion = 1,
    PerfilIncompleto = 2,
    Activo = 3,
    Desactivado = 4
}
