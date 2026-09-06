using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.Reservar;

public record Response(ReservaExitosaDto Data);

public class ReservarEndpoint : EndpointWithoutRequest<Response>
{
    private readonly AppDbContext _dbContext;

    public ReservarEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/agenda/{id}/reservar");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var usuarioIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(usuarioIdString) || !Guid.TryParse(usuarioIdString, out var usuarioId))
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var bloqueId))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>> { ["id"] = ["El ID del bloque no es válido."] },
                "El identificador del bloque es inválido.");
            return;
        }

        var bloque = await _dbContext.BloquesTurno
            .Include(b => b.Reservas)
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El bloque de turno no fue encontrado.",
                tipoRecurso: "bloque-turno-no-encontrado");
            return;
        }

        // R2: No reservar su propio bloque
        if (bloque.CreadoPorId == usuarioId)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "No puedes reservar tu propio bloque de turno.",
                tipoConflicto: "auto-reserva-bloque");
            return;
        }

        // R3: No bloques pasadas
        if (bloque.EstaVencido)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "No se puede reservar un bloque en fecha pasada.",
                tipoConflicto: "bloque-vencido");
            return;
        }

        // R5: No doble reserva
        var yaReservo = bloque.Reservas.Any(r => r.UsuarioId == usuarioId && r.Activa);
        if (yaReservo)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Ya tienes una reserva activa para este bloque.",
                tipoConflicto: "doble-reserva");
            return;
        }

        // R6: Cupos disponibles
        var cuposDisponibles = bloque.CuposMaximos - bloque.Reservas.Count(r => r.Activa);
        if (cuposDisponibles <= 0)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                "Este bloque ya no tiene cupos disponibles.",
                tipoConflicto: "sin-cupos");
            return;
        }

        // Verificar que el usuario existe
        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId, ct);

        if (usuario == null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(
                HttpContext,
                "El usuario no está registrado en el sistema.");
            return;
        }

        var reserva = new ReservaTurno
        {
            Id = Guid.NewGuid(),
            BloqueTurnoId = bloqueId,
            UsuarioId = usuarioId,
            FechaReserva = DateTimeOffset.UtcNow,
            Activa = true
        };

        _dbContext.ReservasTurno.Add(reserva);
        await _dbContext.SaveChangesAsync(ct);

        var respuesta = new ReservaExitosaDto(
            reserva.Id,
            bloqueId,
            reserva.FechaReserva
        );

        await Send.OkAsync(new Response(respuesta), ct);
    }
}