namespace RACPD.Backend.Domain.Entities;

public class ReservaTurno
{
    public Guid Id { get; set; }
    
    public Guid BloqueTurnoId { get; set; }
    
    public Guid UsuarioId { get; set; }
    
    public DateTimeOffset FechaReserva { get; set; } = DateTimeOffset.UtcNow;
    
    public DateTimeOffset? FechaCancelacion { get; set; }
    
    /// <summary>
    /// Soft delete: false = cancelada.
    /// </summary>
    public bool Activa { get; set; } = true;
    
    // Navegación
    public BloqueTurno BloqueTurno { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
}
