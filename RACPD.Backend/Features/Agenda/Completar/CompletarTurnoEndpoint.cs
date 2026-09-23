using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;
// Nota: usar global::System.Text.Json.JsonSerializer inline para evitar
// colision con 'RACPD.Backend.Features.System' (existe por 'PingEndpoint').

namespace RACPD.Backend.Features.Agenda.Completar;

/// <summary>
/// Endpoint POST /api/agenda/{id}/completar — Persona 3 / Semana 2.
///
/// Crea una <see cref="BitacoraTurno"/> asociada a un bloque de turno y
/// lo marca como completado. Coherente con spec-006 §2.3:
///
/// Reglas duras:
///  R1 — Solo el creador del bloque o un usuario con Reserva activa puede cerrarlo.
///  R2 — No se puede completar un bloque cuya fecha ya pasó más de 24h (ventana de olvido).
///  R3 — Una vez activa la bitácora, el bloque pasa a EstadoRelevo.Completado (idempotente).
///  R4 — Concurrencia: si dos cierres simultáneos -> 409 RFC 7807.
///  R5 — Outbox SI EstadoAnimo ∈ {Mal, MuyMal} — encolado en la MISMA transacción.
///
/// Errores: RFC 7807 estricto vía ProblemDetailsHelper.
/// </summary>
public class CompletarTurnoEndpoint : Endpoint<CompletarTurnoRequest, CompletarTurnoResponse>
{
    private readonly AppDbContext _dbContext;

    public CompletarTurnoEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/agenda/{id}/completar");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CompletarTurnoRequest req, CancellationToken ct)
    {
        var usuarioIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(usuarioIdString) || !Guid.TryParse(usuarioIdString, out var usuarioId))
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        if (!Guid.TryParse(req.Id, out var bloqueId))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>> { ["id"] = ["El ID del bloque no es válido."] },
                "El identificador del bloque es inválido.");
            return;
        }

        // Validación de longitud de campos texto (alineado con maxlength del modelo).
        var erroresValidacion = new Dictionary<string, IEnumerable<string>>();
        if (req.EstadoAnimo is null)
        {
            erroresValidacion["estadoAnimo"] = ["El estado de ánimo es obligatorio."];
        }
        if (req.Sintomas is { Length: > 1000 })
        {
            erroresValidacion["sintomas"] = ["Los síntomas no pueden superar 1000 caracteres."];
        }
        if (req.ObservacionesGenerales is { Length: > 2000 })
        {
            erroresValidacion["observacionesGenerales"] = ["Las observaciones no pueden superar 2000 caracteres."];
        }
        if (req.HorasSueno is < 0m or > 24m)
        {
            erroresValidacion["horasSueno"] = ["Las horas de sueño deben estar entre 0 y 24."];
        }
        if (erroresValidacion.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                erroresValidacion,
                "Los datos de la bitácora no cumplen las reglas de validación.");
            return;
        }

        // === Lectura del bloque (One Trip Pattern) ===
        var bloque = await _dbContext.BloquesTurno
            .Include(b => b.Reservas)
            .Include(b => b.Tareas)
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El bloque de turno no fue encontrado.",
                tipoRecurso: "bloque-turno-no-encontrado");
            return;
        }

        // R1 — Autorización: solo creador o un usuario con Reserva activa.
        var esCreador = bloque.CreadoPorId == usuarioId;
        var tieneReserva = bloque.Reservas.Any(r => r.UsuarioId == usuarioId && r.Activa);
        if (!esCreador && !tieneReserva)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal del bloque o un cuidador de apoyo con reserva activa puede cerrarlo.",
                tipoProhibido: "no-autorizado-completar");
            return;
        }

        // R2 — Ventana de olvido: hasta 24h después del fin del bloque.
        var finOcurrenciaUtc = bloque.CalcularInicioDeOcurrenciaEnEcuador(bloque.Fecha)
            .AddHours(bloque.HoraFin.Hour - bloque.HoraInicio.Hour)
            .AddMinutes(bloque.HoraFin.Minute - bloque.HoraInicio.Minute);
        var ahoraUtc = DateTimeOffset.UtcNow;
        if (ahoraUtc > finOcurrenciaUtc.AddHours(24))
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "El cierre del turno solo puede registrarse hasta 24 horas después de su finalización.",
                tipoConflicto: "fuera-ventana-olvido");
            return;
        }

        // R3 — Idempotencia via índice único parcial en BitacorasTurno.
        // Verificamos ANTES de insertar para devolver un 409 limpio.
        var yaExisteBitacora = await _dbContext.BitacorasTurno
            .AsNoTracking()
            .AnyAsync(b => b.BloqueTurnoId == bloqueId && b.Activa, ct);

        if (yaExisteBitacora)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Este turno ya fue cerrado. La bitácora es inmutable.",
                tipoConflicto: "bitacora-ya-existe");
            return;
        }

        // Validar que los ids de tareas correspondan a tareas del bloque (defensa).
        var idsTareasValidas = bloque.Tareas.Select(t => t.Id).ToHashSet();
        var idsTareasInvalidas = req.TareasRealizadasIds?
            .Where(id => !idsTareasValidas.Contains(id))
            .ToList() ?? new List<Guid>();
        if (idsTareasInvalidas.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["tareasRealizadasIds"] = ["Alguna tarea enviada no pertenece a este bloque."]
                },
                "Tareas realizadas inválidas.");
            return;
        }

        // === Transacción: Bitácora + Outbox (R5) ===
        await using var transaccion = await _dbContext.Database.BeginTransactionAsync(ct);

        var bitacora = new BitacoraTurno(
            bloqueId,
            usuarioId,
            req.EstadoAnimo!.Value,
            req.Sintomas,
            req.HorasSueno,
            req.ObservacionesGenerales,
            req.TareasRealizadasIds ?? new List<Guid>()
        );

        _dbContext.BitacorasTurno.Add(bitacora);

        // R5 — Outbox si el estado de ánimo es crítico (en la misma transacción).
        if (req.EstadoAnimo is EstadoAnimoTurno.Mal or EstadoAnimoTurno.MuyMal)
        {
            _dbContext.OutboxMensajes.Add(new OutboxMensaje
            {
                Id = Guid.NewGuid(),
                Tipo = "BITACORA_ANIMO_CRITICO",
                PayloadJson = global::System.Text.Json.JsonSerializer.Serialize(new
                {
                    bitacoraId = bitacora.Id,
                    bloqueId,
                    registradoPorId = usuarioId,
                    estadoAnimo = req.EstadoAnimo!.Value.ToString(),
                    fechaCierre = bitacora.FechaCierre,
                }),
                Fecha = DateTimeOffset.UtcNow,
                Procesado = false,
            });
        }

        try
        {
            await _dbContext.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // R4 — concurrencia pesimista (otro caregiver cerró al mismo tiempo).
            await transaccion.RollbackAsync(ct);
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Otro cuidador cerró este turno simultáneamente. Recarga para ver el reporte.",
                tipoConflicto: "concurrencia-completar");
            return;
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23505")
        {
            // R3 — índice único: cierre concurrente que pasó el check anterior.
            await transaccion.RollbackAsync(ct);
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Este turno ya fue cerrado por otro cuidador.",
                tipoConflicto: "bitacora-ya-existe");
            return;
        }

        var respuesta = new CompletarTurnoResponse(
            bitacora.Id,
            bloqueId,
            bitacora.FechaCierre,
            req.EstadoAnimo!.Value.ToString()
        );

        await Send.CreatedAtAsync(
            nameof(CompletarTurnoEndpoint),
            new { id = bitacora.Id.ToString() },
            respuesta,
            cancellation: ct);
    }
}

/// <summary>
/// Request para cerrar un turno con su Bitácora. Persona 3 / Semana 2.
/// <c>Id</c> viene del path segment <c>{id}</c>; el resto del body es la bitácora.
/// </summary>
public class CompletarTurnoRequest
{
    public string Id { get; set; } = default!;
    public EstadoAnimoTurno? EstadoAnimo { get; set; }
    public string? Sintomas { get; set; }
    public decimal? HorasSueno { get; set; }
    public string? ObservacionesGenerales { get; set; }
    public List<Guid>? TareasRealizadasIds { get; set; }
}

public record CompletarTurnoResponse(
    Guid BitacoraId,
    Guid BloqueId,
    DateTimeOffset FechaCierre,
    string EstadoAnimo
);