using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Agenda.Crear;

// Usamos strings para recibir del frontend y parseamos manualmente
public record Request(
    string Fecha,
    string HoraInicio,
    string HoraFin,
    int CuposMaximos = 1,
    string? Descripcion = null
);

public record Response(Guid Id, string Mensaje);

public class CrearBloqueEndpoint : Endpoint<Request, Response>
{
    private readonly AppDbContext _dbContext;

    public CrearBloqueEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/agenda");
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

        // Parsear fecha
        if (!DateOnly.TryParse(req.Fecha, out var fecha))
        {
            AddError("La fecha no tiene un formato válido (YYYY-MM-DD).", nameof(req.Fecha));
        }

        // Parsear hora inicio
        if (!TimeOnly.TryParse(req.HoraInicio, out var horaInicio))
        {
            AddError("La hora de inicio no tiene un formato válido (HH:mm).", nameof(req.HoraInicio));
        }

        // Parsear hora fin
        if (!TimeOnly.TryParse(req.HoraFin, out var horaFin))
        {
            AddError("La hora de fin no tiene un formato válido (HH:mm).", nameof(req.HoraFin));
        }

        ThrowIfAnyErrors();

        // Verificar que el usuario existe
        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId, ct);

        if (usuario == null)
        {
            AddError("El usuario no está registrado en el sistema.");
            ThrowIfAnyErrors();
            return;
        }

        // Validaciones de negocio
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        if (fecha < hoy)
        {
            AddError("No se pueden crear bloques en fechas pasadas.", nameof(req.Fecha));
        }

        if (horaFin <= horaInicio)
        {
            AddError("La hora de fin debe ser posterior a la hora de inicio.", nameof(req.HoraFin));
        }

        if (req.CuposMaximos < 1 || req.CuposMaximos > 5)
        {
            AddError("Los cupos deben estar entre 1 y 5.", nameof(req.CuposMaximos));
        }

        if (!string.IsNullOrWhiteSpace(req.Descripcion) && req.Descripcion.Length > 200)
        {
            AddError("La descripción no puede exceder 200 caracteres.", nameof(req.Descripcion));
        }

        ThrowIfAnyErrors();

        var bloque = new BloqueTurno
        {
            Id = Guid.NewGuid(),
            Fecha = fecha,
            HoraInicio = horaInicio,
            HoraFin = horaFin,
            CuposMaximos = req.CuposMaximos,
            Descripcion = req.Descripcion?.Trim(),
            CreadoPorId = usuarioId,
            FechaCreacion = DateTimeOffset.UtcNow
        };

        _dbContext.BloquesTurno.Add(bloque);
        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response(bloque.Id, "Bloque de turno creado exitosamente."), ct);
    }
}
