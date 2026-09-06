namespace RACPD.Backend.Domain.Enums;

/// <summary>
/// Rol que un <see cref="Entities.Usuario"/> tiene sobre un
/// <see cref="Entities.PerfilDependiente"/> específico a través de un vínculo.
///
/// Es ortogonal al <see cref="Rol"/> global del usuario: una persona puede
/// tener un rol global (por ejemplo <see cref="Rol.Apoyo"/>) y ser
/// <see cref="CuidadorPrincipal"/> sobre un dependiente particular.
///
/// Regla de unicidad enforced en BD: como máximo un vínculo activo con
/// <see cref="CuidadorPrincipal"/> por perfil dependiente.
/// </summary>
public enum RolEnDependiente
{
    CuidadorPrincipal = 0,
    Apoyo = 1
}
