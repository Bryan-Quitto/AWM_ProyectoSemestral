using System.ComponentModel.DataAnnotations;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

public class BloqueRelevo
{
    public Guid Id { get; init; } = Guid.NewGuid();
    
    public Guid PerfilDependienteId { get; init; }
    public PerfilDependiente PerfilDependiente { get; init; } = null!;
    
    public DateTimeOffset InicioUtc { get; set; }
    public DateTimeOffset FinUtc { get; set; }
    
    public EstadoRelevo Estado { get; set; } = EstadoRelevo.Disponible;
    
    [Timestamp]
    public uint Version { get; private set; } 
}
