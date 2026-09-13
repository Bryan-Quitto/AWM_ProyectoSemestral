namespace RACPD.Backend.Domain.Enums;

/// <summary>
/// Estado emocional del paciente reportado por el cuidador de apoyo
/// al cierre (Bitácora) de un turno de relevo.
///
/// Se modela como enum cerrado para permitir alertas visuales automáticas
/// en la ficha del dependiente y filtrado/reportes para el Cuidador Principal.
/// Se persiste como <c>string</c> en base de datos vía
/// <c>HasConversion&lt;string&gt;()</c>.
/// </summary>
public enum EstadoAnimoTurno
{
    MuyBien,
    Bien,
    Neutral,
    Mal,
    MuyMal
}