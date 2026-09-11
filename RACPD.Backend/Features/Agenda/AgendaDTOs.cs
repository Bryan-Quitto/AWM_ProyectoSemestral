namespace RACPD.Backend.Features.Agenda;

// === Requests ===

/// <summary>
/// Request para crear un bloque de turno. Persona 1 / Semana 1.
/// </summary>
public record CrearBloqueRequest(
    string Fecha,                     // YYYY-MM-DD
    string HoraInicio,                // HH:mm
    string HoraFin,                   // HH:mm
    int CuposMaximos = 1,
    string? Descripcion = null,
    Guid PerfilDependienteId = default!,
    string TipoRecurrencia = "Unica",
    int? IntervaloSemanas = null,
    List<TareaTurnoItemRequest>? Tareas = null
);

/// <summary>
/// Request para editar un bloque de turno.
/// Definido como record NO posicional con setters mutables para que
/// FastEndpoints pueda inyectar el path segment <c>{id}</c> en la propiedad
/// <c>Id</c> tras la deserialización del body. Los records posicionales
/// generan setters <c>init</c>-only incompatibles con este binding.
/// </summary>
public record EditarBloqueRequest
{
    /// <summary>Identificador del bloque. Se bindea desde el path segment <c>{id}</c>.</summary>
    public Guid Id { get; set; }

    public string Fecha { get; set; } = default!;
    public string HoraInicio { get; set; } = default!;
    public string HoraFin { get; set; } = default!;
    public int CuposMaximos { get; set; }
    public string? Descripcion { get; set; }
    public Guid PerfilDependienteId { get; set; }
    public string TipoRecurrencia { get; set; } = "Unica";
    public int? IntervaloSemanas { get; set; }
    public List<TareaTurnoItemRequest>? Tareas { get; set; }
}

/// <summary>
/// Ítem de tarea enviado por el frontend.
/// El cliente puede omitir el <c>Id</c>; el backend lo genera con <see cref="Guid.NewGuid"/>.
/// </summary>
public record TareaTurnoItemRequest(Guid? Id, string Descripcion, int Orden);

// === Responses ===

/// <summary>
/// DTO para retornar la información de un bloque de turno.
/// Usa strings para fecha/hora para compatibilidad con JSON del frontend.
/// Persona 1 / Semana 1: incluye tenancy clínica, recurrencia y tareas.
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
    bool YaReservé,
    Guid PerfilDependienteId,
    string NombreDependiente,
    string TipoRecurrencia,
    int? IntervaloSemanas,
    IReadOnlyList<TareaTurnoDto> Tareas
);

/// <summary>
/// DTO de tarea devuelto al frontend.
/// </summary>
public record TareaTurnoDto(Guid Id, string Descripcion, int Orden);

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
/// DTO para respuesta de creación exitosa.
/// </summary>
public record CrearBloqueResponseDto(Guid Id, string Mensaje);

/// <summary>
/// DTO para respuesta de edición exitosa.
/// </summary>
public record EditarBloqueResponseDto(string Mensaje);

/// <summary>
/// DTO para respuesta de reserva exitosa.
/// </summary>
public record ReservaExitosaDto(
    Guid ReservaId,
    Guid BloqueId,
    DateTimeOffset ConfirmadoEn
);
