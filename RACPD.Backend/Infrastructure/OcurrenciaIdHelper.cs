using System.Security.Cryptography;
using System.Text;

namespace RACPD.Backend.Infrastructure;

/// <summary>
/// Genera un GUID determinista y estable para identificar una ocurrencia
/// proyectada de un bloque maestro de turno. No requiere estado en BD.
/// Espacio: 128 bits derivados de SHA-1 (primeros 16 bytes del hash).
///
/// Semilla: <c>"{IdBloqueMaestro:N}|{FechaOc:yyyy-MM-dd}"</c>.
/// Resultado: <c>Guid.ParseExact(hex, "N")</c> a partir de los primeros
/// 32 caracteres hexadecimales del SHA-1 (16 bytes).
/// </summary>
/// <remarks>
/// La determinismo garantiza que backend y frontend puedan convenir la
/// misma llave de ocurrencia sin almacenamiento adicional. La colisión
/// práctica es despreciable: 2^128 espacio vs. cardinalidad finita y
/// acotada del dominio (IdBloqueMaestro es Guid.NewGuid, único).
/// </remarks>
public static class OcurrenciaIdHelper
{
    /// <summary>
    /// Calcula el identificador estable de una ocurrencia proyectada.
    /// </summary>
    /// <param name="idBloqueMaestro">Guid del bloque maestro original.</param>
    /// <param name="fechaOc">Fecha de la ocurrencia proyectada (día calendario, UTC-5 Ecuador).</param>
    /// <returns>Guid determinista único para el par (maestro, fecha).</returns>
    public static Guid CalcularIdOcurrencia(Guid idBloqueMaestro, DateOnly fechaOc)
    {
        var semilla = $"{idBloqueMaestro:N}|{fechaOc:yyyy-MM-dd}";
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(semilla));
        var hex = Convert.ToHexString(hash, 0, 16).ToLowerInvariant();
        return Guid.ParseExact(hex, "N");
    }
}