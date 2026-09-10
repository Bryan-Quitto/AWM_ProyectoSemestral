using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

public class BloqueTurno
{
    public Guid Id { get; set; }

    public DateOnly Fecha { get; set; }

    public TimeOnly HoraInicio { get; set; }

    public TimeOnly HoraFin { get; set; }

    public int CuposMaximos { get; set; } = 1;

    // === Persona 1 / Semana 1 ===
    // Nullable en Fase A de la migración. Se consolidará a NOT NULL en Fase C.
    // El handler rechaza requests sin este valor (RF-1).
    public Guid? PerfilDependienteId { get; set; }
    public TipoRecurrencia TipoRecurrencia { get; set; } = TipoRecurrencia.Unica;
    public int? IntervaloSemanas { get; set; }
    public List<TareaTurnoItem> Tareas { get; set; } = [];

    public string? Descripcion { get; set; }

    // Campo legacy "EsRecurrente" eliminado en esta iteración (reemplazado por TipoRecurrencia).

    public Guid CreadoPorId { get; set; }

    public DateTimeOffset FechaCreacion { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? FechaModificacion { get; set; }

    // Navegación
    public PerfilDependiente PerfilDependiente { get; set; } = null!;
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
