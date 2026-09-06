using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

/// <summary>
/// Relación N:M entre <see cref="Usuario"/> y <see cref="PerfilDependiente"/>
/// con un rol específico por dependiente (<see cref="RolEnDependiente"/>).
///
/// Permite modelar:
/// - Un cuidador principal que gestiona varios perfiles dependientes (1:N).
/// - Varios cuidadores de apoyo sobre un mismo perfil dependiente (N:M).
/// - Regla de unicidad: a lo sumo un cuidador principal activo por perfil
///   (enforced por índice único parcial en BD).
/// </summary>
public class VinculoDependiente
{
    public VinculoDependiente()
    {
    }

    public VinculoDependiente(
        Guid usuarioId,
        Guid perfilDependienteId,
        RolEnDependiente rolEnDependiente,
        Guid? asignadoPorUsuarioId = null)
    {
        Id = Guid.NewGuid();
        UsuarioId = usuarioId;
        PerfilDependienteId = perfilDependienteId;
        RolEnDependiente = rolEnDependiente;
        Activo = true;
        FechaAsignacion = DateTimeOffset.UtcNow;
        AsignadoPorUsuarioId = asignadoPorUsuarioId;
    }

    public Guid Id { get; init; } = Guid.NewGuid();

    public Guid UsuarioId { get; init; }
    public Usuario Usuario { get; init; } = null!;

    public Guid PerfilDependienteId { get; init; }
    public PerfilDependiente PerfilDependiente { get; init; } = null!;

    public RolEnDependiente RolEnDependiente { get; set; }

    public bool Activo { get; set; } = true;

    public DateTimeOffset FechaAsignacion { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Auditoría: usuario que creó este vínculo. Nulo en seeds/migraciones.
    /// </summary>
    public Guid? AsignadoPorUsuarioId { get; init; }
}
