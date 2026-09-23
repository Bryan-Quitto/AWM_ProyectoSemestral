namespace RACPD.Backend.Domain.Entities;

/// <summary>
/// Outbox Pattern (REGLA-EF-OUTBOX-PATTERN del SKILLS.md):
/// mensajes diferidos a procesar por un Background Job.
///
/// Solo el endpoint que INSERTA conoce el payload. El job lee
/// `WHERE Procesado = false ORDER BY Fecha FOR UPDATE SKIP LOCKED`
/// y dispatcha al canal externo (push, email, etc.).
///
/// Persona 3 / Semana 2: insertado por CompletarTurnoEndpoint cuando
/// el estado de ánimo del paciente es Mal o MuyMal (notificación vital).
/// </summary>
public class OutboxMensaje
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tipo de evento: BITACORA_ANIMO_CRITICO, INVITACION_USUARIO, etc.</summary>
    public string Tipo { get; set; } = string.Empty;

    /// <summary>JSON con el cuerpo del mensaje. Validar al deserializar en el consumer.</summary>
    public string PayloadJson { get; set; } = "{}";

    /// <summary>Instante UTC de creacion del mensaje.</summary>
    public DateTimeOffset Fecha { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>False al insertar. Lo marca true el Background Job al procesar.</summary>
    public bool Procesado { get; set; } = false;

    /// <summary>Numero de intentos de procesamiento. Para backoff exponencial.</summary>
    public int Intentos { get; set; } = 0;

    /// <summary>Si fallo permanente, el job lo marca para no reintentarlo.</summary>
    public bool Fallo { get; set; } = false;
}