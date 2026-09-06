using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

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
            AddError("No se pudo identificar al usuario autenticado.");
            ThrowIfAnyErrors();
            return;
        }

        if (!Guid.TryParse(Route<string>("id"), out var bloqueId))
        {
            AddError("El ID del bloque no es válido.");
            ThrowIfAnyErrors();
            return;
        }

        var reserva = await _dbContext.ReservasTurno
            .Include(r => r.BloqueTurno)
            .FirstOrDefaultAsync(r => r.BloqueTurnoId == bloqueId && r.UsuarioId == usuarioId && r.Activa, ct);

        if (reserva == null)
        {
            AddError("No tienes una reserva activa para este bloque.", "id");
            ThrowIfAnyErrors();
            return;
        }

        var rolClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? User.FindFirstValue("role");
        var esAdmin = rolClaim?.Equals(Rol.AdministradorSistema.ToString(), StringComparison.OrdinalIgnoreCase) == true;

        // Solo el dueño de la reserva o admin puede cancelar
        if (!esAdmin && reserva.UsuarioId != usuarioId)
        {
            AddError("Solo quien hizo la reserva o un administrador pueden cancelarla.");
            ThrowIfAnyErrors();
            return;
        }

        // Soft delete
        reserva.Activa = false;
        reserva.FechaCancelacion = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Reserva cancelada exitosamente."), ct);
    }
}
