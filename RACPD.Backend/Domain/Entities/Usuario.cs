using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

public class Usuario
{
    public Guid Id { get; set; }
    public string Correo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Apellido { get; set; } = string.Empty;
    public Rol Rol { get; set; }
}
