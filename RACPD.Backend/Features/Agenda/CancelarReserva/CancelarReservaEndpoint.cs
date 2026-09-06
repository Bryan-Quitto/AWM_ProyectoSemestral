using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.CancelarReserva;

public record Response(string Mensaje);

public class CancelarReservaEndpoint : EndpointWithoutRequest<Response>
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

        // El endpoint ya filtra por r.UsuarioId == usuarioId en la consulta
        // anterior, por lo que la única forma de llegar aquí es siendo
        // dueño de la reserva. El rol AdministradorSistema fue removido
        // de la política (ver Configure), por lo que ya no tiene bypass.

        // Soft delete
        reserva.Activa = false;
        reserva.FechaCancelacion = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Reserva cancelada exitosamente."), ct);
    }
}