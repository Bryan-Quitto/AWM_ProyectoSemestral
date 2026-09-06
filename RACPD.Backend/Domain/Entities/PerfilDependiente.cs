using System.ComponentModel.DataAnnotations;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

public class PerfilDependiente
{
    public PerfilDependiente()
    {
    }

    public PerfilDependiente(
        Guid creadoPorUsuarioId,
        string nombreCompleto,
        TipoSangre tipoSangre,
        string condicionesCronicas,
        List<string> alergiasEstructuradas,
        List<ContactoEmergencia> contactosEmergencia)
    {
        Id = Guid.NewGuid();
        CreadoPorUsuarioId = creadoPorUsuarioId;
        NombreCompleto = nombreCompleto;
        TipoSangre = tipoSangre;
        CondicionesCronicas = condicionesCronicas;
        AlergiasEstructuradas = alergiasEstructuradas;
        ContactosEmergencia = contactosEmergencia;
        Activo = true;
    }

    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>
    /// Auditoría: usuario que creó originalmente este perfil.
    /// NO se usa para autorizar operaciones; eso se hace vía <see cref="VinculoDependiente"/>.
    /// </summary>
    public Guid CreadoPorUsuarioId { get; init; }

    public string NombreCompleto { get; private set; } = string.Empty;
    public TipoSangre TipoSangre { get; private set; } = TipoSangre.Desconocido;
    public string CondicionesCronicas { get; private set; } = string.Empty;

    public List<string> AlergiasEstructuradas { get; private set; } = [];

    public List<ContactoEmergencia> ContactosEmergencia { get; private set; } = [];

    /// <summary>
    /// Soft-delete. Por defecto true. Solo el cuidador principal del perfil
    /// puede desactivarlo vía endpoint.
    /// </summary>
    public bool Activo { get; private set; } = true;

    public DateTimeOffset? FechaEliminacion { get; private set; }

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

    /// <summary>
    /// Soft-delete del perfil. Idempotente: si ya está inactivo no hace nada.
    /// </summary>
    public void Desactivar()
    {
        if (Activo)
        {
            Activo = false;
            FechaEliminacion = DateTimeOffset.UtcNow;
        }
    }
}

public class ContactoEmergencia
{
    public string Nombre { get; set; } = string.Empty;
    public string Relacion { get; set; } = string.Empty;
    public string TelefonoWhatsApp { get; set; } = string.Empty;
}
