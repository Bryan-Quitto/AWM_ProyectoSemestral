using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.CancelarReserva;

public record Response(string Mensaje);

public class CancelarReservaEndpoint : Endpoint<CancelarReservaRequest, Response>
{
    private readonly AppDbContext _dbContext;

    public CancelarReservaEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Delete("/api/agenda/{id}/reserva");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CancelarReservaRequest req, CancellationToken ct)
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

        // === Persona 2 / Semana 2: fecha de la OCURRENCIA (no del maestro) ===
        // Con la proyección de ocurrencias (Persona 1), el mismo bloque maestro
        // genera múltiples turnos recurrentes. La antena de 72h debe evaluarse
        // contra la fecha de la OCURRENCIA que el usuario reservó, no contra
        // la fecha base del maestro. Si el cliente no envía la fecha, caemos
        // a la fecha base (modo legacy, sólo válido para bloques Unica).
        DateOnly fechaOc;
        if (!string.IsNullOrWhiteSpace(req.Fecha))
        {
            if (!DateOnly.TryParseExact(req.Fecha, "yyyy-MM-dd", out fechaOc))
            {
                await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                    HttpContext,
                    new Dictionary<string, IEnumerable<string>> { ["fecha"] = ["Formato YYYY-MM-dd esperado."] },
                    "La fecha de la ocurrencia es inválida.");
                return;
            }
        }
        else
        {
            fechaOc = default!;  // se completará tras cargar el bloque
        }

        var reserva = await _dbContext.ReservasTurno
            .Include(r => r.BloqueTurno)
            .FirstOrDefaultAsync(r => r.BloqueTurnoId == bloqueId && r.UsuarioId == usuarioId && r.Activa, ct);

        if (reserva == null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "No tienes una reserva activa para este bloque.",
                tipoRecurso: "reserva-activa-no-encontrada");
            return;
        }

        // Si no nos pasaron fecha, usamos la fecha base (modo legacy / Unica).
        if (string.IsNullOrWhiteSpace(req.Fecha))
        {
            fechaOc = reserva.BloqueTurno.Fecha;
        }

        // El endpoint ya filtra por r.UsuarioId == usuarioId en la consulta
        // anterior, por lo que la única forma de llegar aquí es siendo
        // dueño de la reserva. El rol AdministradorSistema fue removido
        // de la política (ver Configure), por lo que ya no tiene bypass.

        // === REGLA DURA: antena mínima de cancelación 72h (Persona 2 / Semana 2) ===
        // Una cancelación tardía deja al dependiente desatendido. Si faltan
        // MENOS de 72h para el inicio del turno, el cuidador de apoyo debe
        // coordinar con el Cuidador Principal por canal humano (WhatsApp/tel).
        // El cálculo de inicio evalúa la fecha de la OCURRENCIA concreta para
        // que la regla sea correcta en bloques recurrentes.
        var inicioTurnoUtc = reserva.BloqueTurno.CalcularInicioDeOcurrenciaEnEcuador(fechaOc);
        var ahoraUtc = DateTimeOffset.UtcNow;
        var antelacion = inicioTurnoUtc - ahoraUtc;

        if (antelacion < TimeSpan.FromHours(72))
        {
            var horasRestantes = Math.Max(0, (int)Math.Floor(antelacion.TotalHours));
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["antelacion"] = new[]
                    {
                        $"Faltan aproximadamente {horasRestantes}h para el inicio del turno. Se requieren al menos 72h (3 días) de antelación."
                    }
                },
                detalle: "No es posible cancelar la reserva con menos de 72 horas (3 días) de antelación. Debe comunicarse con el cuidador principal.",
                titulo: "Antena de cancelación insuficiente");
            return;
        }

        // Soft delete
        reserva.Activa = false;
        reserva.FechaCancelacion = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Reserva cancelada exitosamente."), ct);
    }
}

/// <summary>
/// Request para cancelación de reserva (Persona 2 / Semana 2).
/// <c>Fecha</c> es la fecha de la OCURRENCIA que el usuario reservó (YYYY-MM-dd),
/// NO la fecha base del maestro. Requerida para reglas temporales correctas
/// en bloques recurrentes; opcional para bloques Unica (default a Fecha base).
/// </summary>
public class CancelarReservaRequest
{
    public string Id { get; set; } = default!;
    public string? Fecha { get; set; }
}