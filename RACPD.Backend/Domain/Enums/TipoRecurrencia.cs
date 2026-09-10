namespace RACPD.Backend.Domain.Enums;

/// <summary>
/// Modalidad de repetición de un <see cref="Entities.BloqueTurno"/>.
/// Es la ÚNICA fuente de verdad (reemplaza el antiguo campo bool EsRecurrente).
/// </summary>
public enum TipoRecurrencia
{
    /// <summary>Una sola vez, sin repetición.</summary>
    Unica = 0,

    /// <summary>Se repite de forma indefinida hasta que el cuidador lo detenga.</summary>
    Indefinida = 1,

    /// <summary>Se repite cada N semanas. N se almacena en <c>BloqueTurno.IntervaloSemanas</c> (rango 1..24).</summary>
    Semanas = 2
}
