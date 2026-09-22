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

    /// <summary>
    /// Une <see cref="Fecha"/> + <see cref="HoraInicio"/> y los interpreta como
    /// hora local de Ecuador (America/Guayaquil) para devolver el instante
    /// de inicio del turno en UTC.
    ///
    /// Esto es crítico para reglas temporales duras (ej. antena mínima de
    /// cancelación de 72h) porque la entidad no almacena un
    /// <c>DateTimeOffset</c> explícito; hacerlo aquí evita filtrar lógica
    /// de huso horario a cada endpoint.
    ///
    /// IMPORTANTE: con la proyección de ocurrencias (Semana 2 / Persona 1),
    /// <see cref="Fecha"/> es la fecha BASE del bloque maestro, no la fecha
    /// de la ocurrencia que el usuario reservó. Para reglas temporales sobre
    /// una ocurrencia concreta, usar
    /// <see cref="CalcularInicioDeOcurrenciaEnEcuador(DateOnly)"/>.
    /// </summary>
    public DateTimeOffset CalcularInicioEnEcuador()
    {
        return CalcularInicioDeOcurrenciaEnEcuador(Fecha);
    }

    /// <summary>
    /// Calcula el instante UTC de inicio para una ocurrencia proyectada
    /// concreta del bloque, usando su fecha propia en lugar de
    /// <see cref="Fecha"/> (la fecha base del maestro). Reutiliza
    /// <see cref="HoraInicio"/> y la zona horaria de Ecuador.
    /// </summary>
    public DateTimeOffset CalcularInicioDeOcurrenciaEnEcuador(DateOnly fechaOcurrencia)
    {
        var localSinZona = new DateTime(
            fechaOcurrencia.Year, fechaOcurrencia.Month, fechaOcurrencia.Day,
            HoraInicio.Hour, HoraInicio.Minute, 0,
            DateTimeKind.Unspecified);
        var utc = TimeZoneInfo.ConvertTimeToUtc(localSinZona, ZonaEcuador.Ecuador);
        return new DateTimeOffset(utc, TimeSpan.Zero);
    }
}
