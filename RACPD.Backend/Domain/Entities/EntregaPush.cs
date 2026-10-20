using RACPD.Backend.Domain.Enums;
namespace RACPD.Backend.Domain.Entities;
public class EntregaPush
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OutboxMensajeId { get; set; }
    public Guid SuscripcionPushId { get; set; }
    public Guid PerfilDependienteId { get; set; }
    public EstadoEntregaPush Estado { get; set; } = EstadoEntregaPush.Pendiente;
    public int Intentos { get; set; }
    public DateTimeOffset ProximoIntento { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ArrendamientoHasta { get; set; }
    public Guid? TokenReclamacion { get; set; }
    public DateTimeOffset? FechaAceptacion { get; set; }
    public int? UltimoCodigoHttp { get; set; }
    public string? UltimoErrorClasificado { get; set; }
}
