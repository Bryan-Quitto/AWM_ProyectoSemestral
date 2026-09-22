namespace RACPD.Backend.Infrastructure;

/// <summary>
/// Helpers de zona horaria para RACPD.
///
/// Regla SKILLS.md §3: "Huso Horario Estricto: operar bajo America/Guayaquil".
/// Crítico porque los cuidadores y el servidor pueden estar en zonas
/// distintas y aun así esperar que la regla de negocio ("no se pueden
/// crear bloques en fechas pasadas") se evalúe contra el día calendario
/// de Ecuador, no contra UTC.
///
/// Uso:
/// <code>
/// var hoy = = ZonaEcuador.HoyLocal;   // DateOnly del día en Ecuador
/// </code>
/// </summary>
public static class ZonaEcuador
{
    /// <summary>
    /// Zona horaria oficial de Ecuador continental (UTC-5, sin DST).
    /// Cacheada en un static readonly para evitar el coste de
    /// <see cref="TimeZoneInfo.FindSystemTimeZoneById"/> en cada request.
    /// </summary>
    public static readonly TimeZoneInfo Ecuador = CargarZonaEcuador();

    /// <summary>
    /// Devuelve el <see cref="DateOnly"/> actual en Ecuador.
    /// Es la fuente de verdad que reemplaza <c>DateOnly.FromDateTime(DateTime.UtcNow)</c>
    /// en cualquier regla de negocio que dependa del "día de Ecuador".
    /// </summary>
    public static DateOnly HoyLocal =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTime.UtcNow, Ecuador));

    private static TimeZoneInfo CargarZonaEcuador()
    {
        // IANA id (Linux/macOS y Windows modernos). Fallback al id antiguo
        // de Windows por si el host corre en un entorno restringido.
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Guayaquil");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
        }
    }
}