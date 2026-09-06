namespace RACPD.Backend.Features.Agenda;

/// <summary>
/// DTO para retornar la información de un bloque de turno.
/// Usa strings para fecha/hora para compatibilidad con JSON del frontend.
/// </summary>
public record BloqueTurnoDto(
    Guid Id,
    string Fecha,        // "YYYY-MM-DD"
    string HoraInicio,   // "HH:mm:ss"
    string HoraFin,      // "HH:mm:ss"
    int CuposMaximos,
    int CuposDisponibles,
    string? Descripcion,
    UsuarioResumenDto CreadoPor,
    IReadOnlyList<ReservaTurnoDto> Reservas,
    bool PuedoReservar,
    bool YaReservé
);

/// <summary>
/// DTO resumido para información de usuario.
/// </summary>
public record UsuarioResumenDto(
    Guid Id,
    string NombreCompleto
);

/// <summary>
/// DTO para información de una reserva.
/// </summary>
public record ReservaTurnoDto(
    Guid Id,
    UsuarioResumenDto Usuario,
    bool EsMiReserva
);

/// <summary>
/// DTO para respuesta de reserva exitosa.
/// </summary>
public record ReservaExitosaDto(
    Guid ReservaId,
    Guid BloqueId,
    DateTimeOffset ConfirmadoEn
);
