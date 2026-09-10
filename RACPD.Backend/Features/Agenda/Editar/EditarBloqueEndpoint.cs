using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.Editar;

/// <summary>
/// Endpoint PUT /api/agenda/{id} — Edita un bloque de turno.
/// Persona 1 / Semana 1:
/// - Tenancy clínica: el usuario debe ser creador del bloque Y tener un
///   <c>VinculoDependiente</c> activo con rol <see cref="RolEnDependiente.CuidadorPrincipal"/>
///   sobre el (nuevo o mismo) dependiente.
/// - Recurrencia y Tareas: mismas reglas que en Crear.
/// </summary>
public class EditarBloqueEndpoint : Endpoint<EditarBloqueConId, EditarBloqueResponseDto>
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

    public override async Task HandleAsync(EditarBloqueConId req, CancellationToken ct)
    {
        var usuarioId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioId is null)
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

        var body = req.Data;

        // === Parseo ===
        var erroresParseo = new Dictionary<string, IEnumerable<string>>();
        DateOnly? fecha = null;
        TimeOnly? horaInicio = null;
        TimeOnly? horaFin = null;

        if (!DateOnly.TryParse(body.Fecha, out var f))
            erroresParseo["fecha"] = ["La fecha no tiene un formato válido (YYYY-MM-DD)."];
        else
            fecha = f;

        if (!TimeOnly.TryParse(body.HoraInicio, out var hi))
            erroresParseo["horaInicio"] = ["La hora de inicio no tiene un formato válido (HH:mm)."];
        else
            horaInicio = hi;

        if (!TimeOnly.TryParse(body.HoraFin, out var hf))
            erroresParseo["horaFin"] = ["La hora de fin no tiene un formato válido (HH:mm)."];
        else
            horaFin = hf;

        if (erroresParseo.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                erroresParseo,
                "Los campos enviados no cumplen el formato esperado.");
            return;
        }

        // === Carga del bloque ===
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

        // Solo el creador puede editar
        if (bloque.CreadoPorId != usuarioId.Value)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "Solo el cuidador principal que creó este bloque puede editarlo.",
                tipoProhibido: "no-creador-bloque");
            return;
        }

        // === Validación de PerfilDependienteId + Recurrencia + Tareas ===
        var erroresNegocio = new Dictionary<string, IEnumerable<string>>();

        if (body.PerfilDependienteId == Guid.Empty)
            erroresNegocio["perfilDependienteId"] = ["Debe seleccionar un dependiente válido."];

        if (!Enum.TryParse<TipoRecurrencia>(body.TipoRecurrencia, ignoreCase: true, out var tipoRecurrencia))
        {
            erroresNegocio["tipoRecurrencia"] = ["Valor inválido. Use: Unica, Indefinida o Semanas."];
            tipoRecurrencia = TipoRecurrencia.Unica;
        }

        if (tipoRecurrencia == TipoRecurrencia.Semanas)
        {
            if (body.IntervaloSemanas is null || body.IntervaloSemanas < 1 || body.IntervaloSemanas > 24)
            {
                erroresNegocio["intervaloSemanas"] = ["Debe especificar un intervalo entre 1 y 24 semanas."];
            }
        }
        else if (body.IntervaloSemanas is not null)
        {
            erroresNegocio["intervaloSemanas"] = ["El intervalo solo aplica para recurrencia semanal."];
        }

        var tareasNormalizadas = new List<TareaTurnoItem>();
        if (body.Tareas is not null && body.Tareas.Count > 0)
        {
            if (body.Tareas.Count > 20)
            {
                erroresNegocio["tareas"] = ["Máximo 20 tareas permitidas por bloque."];
            }
            else
            {
                for (var i = 0; i < body.Tareas.Count; i++)
                {
                    var t = body.Tareas[i];
                    var desc = (t.Descripcion ?? string.Empty).Trim();
                    if (desc.Length < 1 || desc.Length > 200)
                    {
                        erroresNegocio["tareas"] = [$"La tarea #{i + 1} debe tener una descripción entre 1 y 200 caracteres."];
                        continue;
                    }
                    if (t.Orden < 0)
                    {
                        erroresNegocio["tareas"] = [$"La tarea #{i + 1} tiene un orden inválido (debe ser >= 0)."];
                        continue;
                    }
                    tareasNormalizadas.Add(new TareaTurnoItem(
                        t.Id ?? Guid.NewGuid(),
                        desc,
                        t.Orden
                    ));
                }
            }
        }

        // === Validaciones de negocio clásicas ===
        if (horaFin!.Value <= horaInicio!.Value)
            erroresNegocio["horaFin"] = ["La hora de fin debe ser posterior a la hora de inicio."];

        if (body.CuposMaximos < 1 || body.CuposMaximos > 5)
            erroresNegocio["cuposMaximos"] = ["Los cupos deben estar entre 1 y 5."];

        var reservasActivas = bloque.Reservas.Count(r => r.Activa);
        if (body.CuposMaximos < reservasActivas)
        {
            erroresNegocio["cuposMaximos"] = [
                $"No se puede reducir los cupos a {body.CuposMaximos} porque ya hay {reservasActivas} reserva(s) activa(s)."
            ];
        }

        if (!string.IsNullOrWhiteSpace(body.Descripcion) && body.Descripcion.Length > 200)
            erroresNegocio["descripcion"] = ["La descripción no puede exceder 200 caracteres."];

        if (erroresNegocio.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                erroresNegocio,
                "Los datos no cumplen las reglas de negocio del turno.",
                titulo: "Reglas de negocio violadas");
            return;
        }

        // === Tenancy clínica sobre el dependiente (nuevo o el mismo) ===
        var tienePermiso = await _dbContext.VinculosDependientes
            .AsNoTracking()
            .AnyAsync(v =>
                v.UsuarioId == usuarioId.Value &&
                v.PerfilDependienteId == body.PerfilDependienteId &&
                v.Activo &&
                v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal &&
                v.PerfilDependiente.Activo,
                ct);

        if (!tienePermiso)
        {
            await ProblemDetailsHelper.EnviarProhibidoAsync(
                HttpContext,
                "No tienes permisos de Cuidador Principal sobre este dependiente.",
                tipoProhibido: "dependiente-no-autorizado");
            return;
        }

        // === Aplicar cambios ===
        bloque.Fecha = fecha!.Value;
        bloque.HoraInicio = horaInicio!.Value;
        bloque.HoraFin = horaFin!.Value;
        bloque.CuposMaximos = body.CuposMaximos;
        bloque.Descripcion = body.Descripcion?.Trim();
        bloque.PerfilDependienteId = body.PerfilDependienteId;
        bloque.TipoRecurrencia = tipoRecurrencia;
        bloque.IntervaloSemanas = tipoRecurrencia == TipoRecurrencia.Semanas ? body.IntervaloSemanas : null;
        bloque.Tareas = tareasNormalizadas;
        bloque.FechaModificacion = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new EditarBloqueResponseDto("Bloque de turno actualizado exitosamente."), ct);
    }
}

/// <summary>
/// Wrapper necesario porque FastEndpoints envía la request en <c>req.Data</c>
/// cuando la ruta incluye path params.
/// </summary>
public record EditarBloqueConId(EditarBloqueRequest Data);
