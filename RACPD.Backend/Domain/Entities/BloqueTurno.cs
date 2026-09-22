using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Domain.Entities;

public class BloqueTurno
{
    public Guid Id { get; set; }

    public DateOnly Fecha { get; set; }

    public TimeOnly HoraInicio { get; set; }

    public TimeOnly HoraFin { get; set; }

    public int CuposMaximos { get; set; } = 1;

    // === Persona 1 / Semana 1 ===
    // NOT NULL desde Fase C. El handler rechaza requests sin este valor (RF-1).
    public Guid PerfilDependienteId { get; set; }
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
    /// Verifica si el bloque está en el pasado según el huso horario de Ecuador.
    /// SKILLS.md §3: huso horario estricto Ecuador para reglas de negocio.
    /// </summary>
    public bool EstaVencido => Fecha < ZonaEcuador.HoyLocal;
}
