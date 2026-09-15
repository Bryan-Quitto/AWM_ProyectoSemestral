using System.Text.Json.Serialization;

namespace RACPD.Backend.Domain.Enums;

/// <summary>
/// Estado persistido del cuidador en el contexto "Directorio de Relevos".
///
/// Es independiente del estado de su cuenta en <c>Usuario</c>:
/// - <c>Disponible</c>: aparece en el directorio y puede ser contactado.
/// - <c>NoDisponible</c>: existe el registro pero no debe listarse como
///   opción de relevo (viaje, enfermedad, ausencia temporal).
///
/// Coherencia con <c>Usuario.Estado</c>: el endpoint calcula un
/// "EstadoEfectivo" en SQL. Si el usuario no está Activo, el relevo se
/// reporta como NoDisponible aunque la columna esté en Disponible.
/// Esto evita exponer tarjetas de cuentas no operativas.
///
/// Serialización: el atributo fuerza a System.Text.Json (y por extensión
/// a NSwag/Swagger) a emitir el nombre del enum como string, no como
/// entero. Esto es coherente con la regla "Full-Stack Spanish-Only" y
/// con el resto del dominio, y evita que Orval genere un cliente que
/// espere 0/1 cuando el endpoint realmente envía "Disponible" /
/// "NoDisponible".
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EstadoDirectorioRelevo
{
    Disponible,
    NoDisponible
}
