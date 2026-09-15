using System.ComponentModel.DataAnnotations;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

/// <summary>
/// Entrada del Directorio de Relevos: tarjeta de contacto de un cuidador
/// de apoyo para un <c>PerfilDependiente</c> concreto.
///
/// Decisión de diseño (vs reusar Usuario):
/// - Permite anotar disponibilidad, alias y observaciones propias del
///   contexto "relevo" sin contaminar la tabla de identidad.
/// - Coexiste con <c>Usuario</c>: el cuidador debe existir como Usuario
///   (típicamente con Rol.Apoyo) para poder vincularse aquí.
/// </summary>
public class DirectorioRelevo
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>FK al PerfilDependiente al que pertenece este relevo.</summary>
    public Guid PerfilDependienteId { get; init; }
    public PerfilDependiente PerfilDependiente { get; init; } = null!;

    /// <summary>FK al Usuario cuidador de apoyo (debe tener Rol.Apoyo).</summary>
    public Guid UsuarioApoyoId { get; init; }
    public Usuario UsuarioApoyo { get; init; } = null!;

    /// <summary>Nombre a mostrar (puede ser alias si el cuidador lo define).</summary>
    [MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    /// <summary>Teléfono Ecuador (E.164 +5939XXXXXXXX o local 09XXXXXXXX).</summary>
    [MaxLength(20)]
    public string Telefono { get; set; } = string.Empty;

    /// <summary>
    /// Estado del cuidador PARA EL DIRECTORIO. Persistido e independiente
    /// del estado de su cuenta. Default: Disponible.
    /// </summary>
    public EstadoDirectorioRelevo Estado { get; set; } = EstadoDirectorioRelevo.Disponible;

    /// <summary>
    /// Indicador administrativo: el cuidador quiere aparecer en el directorio.
    /// Si es false, NO se lista aunque esté Activo.
    /// </summary>
    public bool Listado { get; set; } = true;

    [MaxLength(500)]
    public string? Notas { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    /// <summary>Soft delete lógico.</summary>
    public bool Activo { get; set; } = true;

    /// <summary>Concurrency token para edición concurrente.</summary>
    [Timestamp]
    public uint Version { get; private set; }
}
