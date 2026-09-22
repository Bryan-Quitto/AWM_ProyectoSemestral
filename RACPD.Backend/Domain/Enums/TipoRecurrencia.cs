namespace RACPD.Backend.Domain.Enums;

/// <summary>
/// Modalidad de repetición de un <see cref="Entities.BloqueTurno"/>.
/// Es la ÚNICA fuente de verdad.
///
/// Razonamiento del modelo (spec-007 §10 Post-Review):
/// El sistema NO puede prometer recurrencia "indefinida" porque la proyección
/// está acotada por el rango de la request (tope absoluto 365 días). Mostrar
/// una opción que el sistema no puede cumplir constituye una mentira al
/// cuidador en un contexto clínico. Por eso solo existen dos variantes:
/// <list type="bullet">
///   <item><description><see cref="Unica"/>: una sola vez, sin repetición.</description></item>
///   <item><description><see cref="Semanas"/>: se repite cada N semanas, donde N
///   se almacena en <c>BloqueTurno.IntervaloSemanas</c> (rango válido 1..24,
///   ≈ hasta 6 meses). El tope concreto elimina la ambigüedad y permite
///   garantizar cobertura real al cuidador.</description></item>
/// </list>
/// </summary>
public enum TipoRecurrencia
{
    /// <summary>Una sola vez, sin repetición.</summary>
    Unica = 0,

    /// <summary>
    /// Se repite cada N semanas. N se almacena en <c>BloqueTurno.IntervaloSemanas</c>
    /// (rango válido 1..24 semanas). El límite concreto garantiza al cuidador
    /// que el sistema puede proyectar y mostrar todas las ocurrencias.
    /// </summary>
    Semanas = 1
}