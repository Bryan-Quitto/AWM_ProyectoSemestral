namespace RACPD.Backend.Domain.Entities;

public class BloqueTurno
{
    public Guid Id { get; set; }
    
    public DateOnly Fecha { get; set; }
    
    public TimeOnly HoraInicio { get; set; }
    
    public TimeOnly HoraFin { get; set; }
    
    public int CuposMaximos { get; set; } = 1;
    
    public string? Descripcion { get; set; }
    
    public bool EsRecurrente { get; set; }
    
    public Guid CreadoPorId { get; set; }
    
    public DateTimeOffset FechaCreacion { get; set; } = DateTimeOffset.UtcNow;
    
    public DateTimeOffset? FechaModificacion { get; set; }
    
    // Navegación
    public Usuario CreadoPor { get; set; } = null!;
    public ICollection<ReservaTurno> Reservas { get; set; } = new List<ReservaTurno>();
    
    /// <summary>
    /// Calcula los cupos disponibles en tiempo de ejecución.
    /// </summary>
    public int CuposDisponibles => CuposMaximos - Reservas.Count(r => r.Activa);
    
    /// <summary>
    /// Verifica si el bloque está en el pasado.
    /// </summary>
    public bool EstaVencido => Fecha < DateOnly.FromDateTime(DateTime.UtcNow);
}
