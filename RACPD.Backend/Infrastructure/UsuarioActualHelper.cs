using System.Security.Claims;

namespace RACPD.Backend.Infrastructure;

/// <summary>
/// Helpers para extraer el identificador del usuario autenticado desde los
/// claims del JWT. Centraliza la búsqueda entre <see cref="ClaimTypes.NameIdentifier"/>
/// y el claim "sub" para soportar distintos proveedores (Supabase, JWT propio).
/// </summary>
public static class UsuarioActualHelper
{
    /// <summary>
    /// Intenta obtener el <see cref="Guid"/> del usuario autenticado.
    /// Devuelve <c>null</c> si el claim no existe o no es un Guid válido.
    /// </summary>
    public static Guid? ObtenerUsuarioId(ClaimsPrincipal? principal)
    {
        if (principal is null) return null;

        var userIdString = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");

        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return null;
        }
        return userId;
    }
}
