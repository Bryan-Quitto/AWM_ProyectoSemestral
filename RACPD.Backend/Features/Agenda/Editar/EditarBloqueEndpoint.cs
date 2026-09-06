using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

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

        // Parsear campos
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
                "Los campos enviados no cumplen el formato esperado.");
            return;
        }

        var bloque = await _dbContext.BloquesTurno
            .Include(b => b.Reservas.Where(r => r.Activa))
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "El bloque de turno no fue encontrado.",
                tipoRecurso: "bloque-turno-no-encontrado");
            return;
        }

        // R: Solo el creador puede editar
        if (bloque.CreadoPorId != usuarioId)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal que creó este bloque puede editarlo.",
                tipoProhibido: "no-creador-bloque");
            return;
        }

        // Validaciones de negocio
        var erroresNegocio = new Dictionary<string, IEnumerable<string>>();
        if (horaFin!.Value <= horaInicio!.Value)
        {
            erroresNegocio["horaFin"] = ["La hora de fin debe ser posterior a la hora de inicio."];
        }
        if (req.CuposMaximos < 1 || req.CuposMaximos > 5)
        {
            erroresNegocio["cuposMaximos"] = ["Los cupos deben estar entre 1 y 5."];
        }

        var reservasActivas = bloque.Reservas.Count(r => r.Activa);
        if (req.CuposMaximos < reservasActivas)
        {
            erroresNegocio["cuposMaximos"] = [
                $"No se puede reducir los cupos a {req.CuposMaximos} porque ya hay {reservasActivas} reserva(s) activa(s)."
            ];
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

        // Actualizar
        bloque.Fecha = fecha!.Value;
        bloque.HoraInicio = horaInicio!.Value;
        bloque.HoraFin = horaFin!.Value;
        bloque.CuposMaximos = req.CuposMaximos;
        bloque.Descripcion = req.Descripcion?.Trim();
        bloque.FechaModificacion = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new Response("Bloque de turno actualizado exitosamente."), ct);
    }
}