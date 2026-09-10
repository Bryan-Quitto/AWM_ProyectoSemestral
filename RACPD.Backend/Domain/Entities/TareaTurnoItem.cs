namespace RACPD.Backend.Domain.Entities;

/// <summary>
/// Ítem de la checklist de tareas asociada a un <see cref="BloqueTurno"/>.
/// Modelado como value object embebido (jsonb en PostgreSQL).
/// Reglas de validación:
/// - <c>Descripcion</c>: longitud entre 1 y 200 caracteres.
/// - <c>Orden</c>: entero >= 0.
/// - Máximo 20 tareas por bloque (validado en el handler).
/// </summary>
public record TareaTurnoItem(Guid Id, string Descripcion, int Orden);
