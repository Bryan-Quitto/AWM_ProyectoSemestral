using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

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

        var rolClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? User.FindFirstValue("role");
        var esAdmin = rolClaim?.Equals(Rol.AdministradorSistema.ToString(), StringComparison.OrdinalIgnoreCase) == true;

        // Solo el creador o admin puede eliminar
        if (!esAdmin && bloque.CreadoPorId != usuarioId)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el creador del bloque o un administrador pueden eliminarlo.",
                tipoProhibido: "no-creador-bloque");
            return;
        }

        // Verificar si hay reservas activas
        var reservasActivas = bloque.Reservas.Count(r => r.Activa);
        if (reservasActivas > 0)
        {
            await ProblemDetailsHelper.EnviarConflictoAsync(
                HttpContext,
                $"No se puede eliminar el bloque porque tiene {reservasActivas} reserva(s) activa(s). Cancela las reservas primero.",
                tipoConflicto: "bloque-con-reservas-activas");
            return;
        }

        _dbContext.BloquesTurno.Remove(bloque);
        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Bloque de turno eliminado exitosamente."), ct);
    }
}