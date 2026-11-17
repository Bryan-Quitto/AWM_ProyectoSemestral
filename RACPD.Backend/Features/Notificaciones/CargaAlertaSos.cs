namespace RACPD.Backend.Features.Notificaciones;

/// <summary>
/// Carga útil del evento Outbox ALERTA_SOS_URGENTE.
/// Emitida cuando un cuidador dispara el botón de emergencia SOS.
/// </summary>
public sealed record CargaAlertaSos(
    Guid AlertaId,
    Guid PerfilDependienteId,
    Guid EmitidoPorUsuarioId,
    DateTimeOffset FechaEmision);
