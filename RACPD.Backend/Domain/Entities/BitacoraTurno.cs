using System.ComponentModel.DataAnnotations;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Domain.Entities;

/// <summary>
/// Reporte clínico y operativo que el cuidador de apoyo (o el cuidador
/// principal) registra al cerrar un <see cref="BloqueTurno"/>.
///
/// Modelada como entidad propia (1:1 con BloqueTurno, enforced por índice
/// único parcial) para preservar histórico auditable y permitir reportes
/// cruzados del Cuidador Principal sobre la evolución del paciente.
///
/// Concurrencia: se usa el token <c>xmin</c> de PostgreSQL (<c>[Timestamp]</c>)
/// para detectar cierres concurrentes del mismo bloque.
/// </summary>
public class BitacoraTurno
{
    public BitacoraTurno()
    {
    }

    public BitacoraTurno(
        Guid bloqueTurnoId,
        Guid registradoPorUsuarioId,
        EstadoAnimoTurno estadoAnimo,
        string? sintomas,
        decimal? horasSueno,
        string? observacionesGenerales,
        List<Guid> tareasRealizadasIds)
    {
        Id = Guid.NewGuid();
        BloqueTurnoId = bloqueTurnoId;
        RegistradoPorUsuarioId = registradoPorUsuarioId;
        EstadoAnimo = estadoAnimo;
        Sintomas = sintomas;
        HorasSueno = horasSueno;
        ObservacionesGenerales = observacionesGenerales;
        TareasRealizadasIds = tareasRealizadasIds;
        Activa = true;
        FechaCierre = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>
    /// Bloque de turno al que pertenece esta bitácora. 1:1 enforced por índice único.
    /// </summary>
    public Guid BloqueTurnoId { get; init; }
    public BloqueTurno BloqueTurno { get; init; } = null!;

    /// <summary>
    /// Usuario (Apoyo o Principal) que registró el cierre. Auditoría.
    /// </summary>
    public Guid RegistradoPorUsuarioId { get; init; }
    public Usuario RegistradoPor { get; init; } = null!;

    public EstadoAnimoTurno EstadoAnimo { get; private set; } = EstadoAnimoTurno.Neutral;

    /// <summary>Texto libre sobre síntomas observados. Máx. 1000 caracteres.</summary>
    public string? Sintomas { get; private set; }

    /// <summary>Horas de sueño del paciente durante el turno. 0..24, 2 decimales.</summary>
    public decimal? HorasSueno { get; private set; }

    /// <summary>Observaciones libres del cuidador. Máx. 2000 caracteres.</summary>
    public string? ObservacionesGenerales { get; private set; }

    /// <summary>
    /// IDs de TareaTurnoItem marcadas como realizadas en este turno.
    /// Vacío si el bloque no tiene checklist o si no se marcó ninguna.
    /// </summary>
    public List<Guid> TareasRealizadasIds { get; private set; } = [];

    public DateTimeOffset FechaCierre { get; private set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Soft-delete. Solo una bitácora activa por bloque (índice único parcial).
    /// </summary>
    public bool Activa { get; private set; } = true;

    [Timestamp]
    public uint Version { get; private set; }
}