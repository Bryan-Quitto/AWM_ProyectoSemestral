using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Agenda.Eliminar;

public record Response(string Mensaje);

public class EliminarBloqueEndpoint : EndpointWithoutRequest<Response>
{
    private readonly AppDbContext _dbContext;

    public EliminarBloqueEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Delete("/api/agenda/{id}");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString());
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

        var bloque = await _dbContext.BloquesTurno
            .Include(b => b.Reservas)
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            AddError("El bloque de turno no fue encontrado.", "id");
            ThrowIfAnyErrors();
            return;
        }

        var rolClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? User.FindFirstValue("role");
        var esAdmin = rolClaim?.Equals(Rol.AdministradorSistema.ToString(), StringComparison.OrdinalIgnoreCase) == true;

        // Solo el creador o admin puede eliminar
        if (!esAdmin && bloque.CreadoPorId != usuarioId)
        {
            AddError("Solo el creador del bloque o un administrador pueden eliminarlo.");
            ThrowIfAnyErrors();
            return;
        }

        // Verificar si hay reservas activas
        var reservasActivas = bloque.Reservas.Count(r => r.Activa);
        if (reservasActivas > 0)
        {
            AddError($"No se puede eliminar el bloque porque tiene {reservasActivas} reserva(s) activa(s). Cancela las reservas primero.");
            ThrowIfAnyErrors();
            return;
        }

        _dbContext.BloquesTurno.Remove(bloque);
        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Bloque de turno eliminado exitosamente."), ct);
    }
}
