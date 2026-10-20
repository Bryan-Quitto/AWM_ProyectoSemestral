namespace RACPD.Backend.Domain.Entities;
public class SuscripcionPush
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public string UrlDestino { get; set; } = string.Empty;
    public string HuellaDestino { get; set; } = string.Empty;
    public string ClavePublica { get; set; } = string.Empty;
    public string SecretoAutenticacion { get; set; } = string.Empty;
    public bool Activa { get; set; } = true;
    public DateTimeOffset FechaCreacion { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset FechaActualizacion { get; set; } = DateTimeOffset.UtcNow;
    public uint Version { get; set; }
}
