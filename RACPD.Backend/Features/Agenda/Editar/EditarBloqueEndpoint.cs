using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Agenda.Editar;

// Usamos strings para recibir del frontend y parseamos manualmente
public record Request(
    string Fecha,
    string HoraInicio,
    string HoraFin,
    int CuposMaximos,
    string? Descripcion
);

public record Response(string Mensaje);

public class EditarBloqueEndpoint : Endpoint<Request, Response>
{
    private readonly AppDbContext _dbContext;

    public EditarBloqueEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Put("/api/agenda/{id}");
        Roles(Rol.CuidadorPrincipal.ToString());
    }

    public override async Task HandleAsync(Request req, CancellationToken ct)
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

        // Parsear campos
        if (!DateOnly.TryParse(req.Fecha, out var fecha))
        {
            AddError("La fecha no tiene un formato válido.", nameof(req.Fecha));
        }

        if (!TimeOnly.TryParse(req.HoraInicio, out var horaInicio))
        {
            AddError("La hora de inicio no tiene un formato válido.", nameof(req.HoraInicio));
        }

        if (!TimeOnly.TryParse(req.HoraFin, out var horaFin))
        {
            AddError("La hora de fin no tiene un formato válido.", nameof(req.HoraFin));
        }

        ThrowIfAnyErrors();

        var bloque = await _dbContext.BloquesTurno
            .Include(b => b.Reservas.Where(r => r.Activa))
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            AddError("El bloque de turno no fue encontrado.", "id");
            ThrowIfAnyErrors();
            return;
        }

        // R: Solo el creador puede editar
        if (bloque.CreadoPorId != usuarioId)
        {
            AddError("Solo el cuidador principal que creó este bloque puede editarlo.");
            ThrowIfAnyErrors();
            return;
        }

        // Validaciones
        if (horaFin <= horaInicio)
        {
            AddError("La hora de fin debe ser posterior a la hora de inicio.", "horaFin");
        }

        if (req.CuposMaximos < 1 || req.CuposMaximos > 5)
        {
            AddError("Los cupos deben estar entre 1 y 5.", "cuposMaximos");
        }

        var reservasActivas = bloque.Reservas.Count(r => r.Activa);
        if (req.CuposMaximos < reservasActivas)
        {
            AddError($"No se puede reducir los cupos a {req.CuposMaximos} porque ya hay {reservasActivas} reserva(s) activa(s).", "cuposMaximos");
        }

        if (!string.IsNullOrWhiteSpace(req.Descripcion) && req.Descripcion.Length > 200)
        {
            AddError("La descripción no puede exceder 200 caracteres.", "descripcion");
        }

        ThrowIfAnyErrors();

        // Actualizar
        bloque.Fecha = fecha;
        bloque.HoraInicio = horaInicio;
        bloque.HoraFin = horaFin;
        bloque.CuposMaximos = req.CuposMaximos;
        bloque.Descripcion = req.Descripcion?.Trim();
        bloque.FechaModificacion = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Bloque de turno actualizado exitosamente."), ct);
    }
}
