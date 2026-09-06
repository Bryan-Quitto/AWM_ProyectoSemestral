using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

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
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // Parsear campos. Errores de parseo → RFC 7807 400.
        var erroresParseo = new Dictionary<string, IEnumerable<string>>();
        DateOnly? fecha = null;
        TimeOnly? horaInicio = null;
        TimeOnly? horaFin = null;

        if (!DateOnly.TryParse(req.Fecha, out var f))
        {
            erroresParseo["fecha"] = ["La fecha no tiene un formato válido (YYYY-MM-DD)."];
        }
        else
        {
            fecha = f;
        }

        if (!TimeOnly.TryParse(req.HoraInicio, out var hi))
        {
            erroresParseo["horaInicio"] = ["La hora de inicio no tiene un formato válido (HH:mm)."];
        }
        else
        {
            horaInicio = hi;
        }

        if (!TimeOnly.TryParse(req.HoraFin, out var hf))
        {
            erroresParseo["horaFin"] = ["La hora de fin no tiene un formato válido (HH:mm)."];
        }
        else
        {
            horaFin = hf;
        }

        if (erroresParseo.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                erroresParseo,
                "Los campos enviados no cumplen el formato esperado.",
                titulo: "Datos de creación inválidos");
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

        // Validaciones de negocio
        var erroresNegocio = new Dictionary<string, IEnumerable<string>>();
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        if (fecha!.Value < hoy)
        {
            erroresNegocio["fecha"] = ["No se pueden crear bloques en fechas pasadas."];
        }
        if (horaFin!.Value <= horaInicio!.Value)
        {
            erroresNegocio["horaFin"] = ["La hora de fin debe ser posterior a la hora de inicio."];
        }
        if (req.CuposMaximos < 1 || req.CuposMaximos > 5)
        {
            erroresNegocio["cuposMaximos"] = ["Los cupos deben estar entre 1 y 5."];
        }
        if (!string.IsNullOrWhiteSpace(req.Descripcion) && req.Descripcion.Length > 200)
        {
            erroresNegocio["descripcion"] = ["La descripción no puede exceder 200 caracteres."];
        }

        if (erroresNegocio.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                erroresNegocio,
                "Los datos no cumplen las reglas de negocio del turno.",
                titulo: "Reglas de negocio violadas");
            return;
        }

        var bloque = new BloqueTurno
        {
            Id = Guid.NewGuid(),
            Fecha = fecha.Value,
            HoraInicio = horaInicio.Value,
            HoraFin = horaFin.Value,
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