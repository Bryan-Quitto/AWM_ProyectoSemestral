using System.ComponentModel.DataAnnotations;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

public class PerfilDependiente
{
    public PerfilDependiente()
    {
    }

    public PerfilDependiente(
        Guid cuidadorPrincipalId,
        string nombreCompleto,
        TipoSangre tipoSangre,
        string condicionesCronicas,
        List<string> alergiasEstructuradas,
        List<ContactoEmergencia> contactosEmergencia)
    {
        Id = Guid.NewGuid();
        CuidadorPrincipalId = cuidadorPrincipalId;
        NombreCompleto = nombreCompleto;
        TipoSangre = tipoSangre;
        CondicionesCronicas = condicionesCronicas;
        AlergiasEstructuradas = alergiasEstructuradas;
        ContactosEmergencia = contactosEmergencia;
    }

    public Guid Id { get; init; } = Guid.NewGuid();
    
    public Guid CuidadorPrincipalId { get; init; } 
    public Usuario CuidadorPrincipal { get; init; } = null!;

    public string NombreCompleto { get; private set; } = string.Empty;
    public TipoSangre TipoSangre { get; private set; } = TipoSangre.Desconocido;
    public string CondicionesCronicas { get; private set; } = string.Empty;
    
    public List<string> AlergiasEstructuradas { get; private set; } = []; 
    
    public List<ContactoEmergencia> ContactosEmergencia { get; private set; } = [];

    [Timestamp]
    public uint Version { get; private set; }

    public void Actualizar(
        string nombreCompleto,
        TipoSangre tipoSangre,
        string condicionesCronicas,
        List<string> alergiasEstructuradas,
        List<ContactoEmergencia> contactosEmergencia)
    {
        NombreCompleto = nombreCompleto;
        TipoSangre = tipoSangre;
        CondicionesCronicas = condicionesCronicas;
        AlergiasEstructuradas = alergiasEstructuradas;
        ContactosEmergencia = contactosEmergencia;
    }
}

public class ContactoEmergencia
{
    public string Nombre { get; set; } = string.Empty;
    public string Relacion { get; set; } = string.Empty;
    public string TelefonoWhatsApp { get; set; } = string.Empty;
}
