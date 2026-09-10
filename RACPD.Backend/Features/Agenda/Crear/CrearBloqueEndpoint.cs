using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.Crear;

/// <summary>
/// Endpoint POST /api/agenda — Crea un bloque de turno.
/// Persona 1 / Semana 1:
/// - Tenancy clínica: el usuario debe tener un <c>VinculoDependiente</c> activo
///   con rol <see cref="RolEnDependiente.CuidadorPrincipal"/> sobre el
///   <c>PerfilDependienteId</c> enviado.
/// - Recurrencia: validada según el spec §5.3.
/// - Tareas: máximo 20, descripción 1..200 chars, orden >= 0.
/// Errores: RFC 7807 estricto vía <see cref="ProblemDetailsHelper"/>.
/// </summary>
public class CrearBloqueEndpoint : Endpoint<CrearBloqueRequest, CrearBloqueResponseDto>
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

    public override async Task HandleAsync(CrearBloqueRequest req, CancellationToken ct)
    {
        var usuarioId = UsuarioActualHelper.ObtenerUsuarioId(User);
        if (usuarioId is null)
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // === Parseo de strings a tipos nativos ===
        var erroresParseo = new Dictionary<string, IEnumerable<string>>();
        DateOnly? fecha = null;
        TimeOnly? horaInicio = null;
        TimeOnly? horaFin = null;

        if (!DateOnly.TryParse(req.Fecha, out var f))
            erroresParseo["fecha"] = ["La fecha no tiene un formato válido (YYYY-MM-DD)."];
        else
            fecha = f;

        if (!TimeOnly.TryParse(req.HoraInicio, out var hi))
            erroresParseo["horaInicio"] = ["La hora de inicio no tiene un formato válido (HH:mm)."];
        else
            horaInicio = hi;

        if (!TimeOnly.TryParse(req.HoraFin, out var hf))
            erroresParseo["horaFin"] = ["La hora de fin no tiene un formato válido (HH:mm)."];
        else
            horaFin = hf;

        if (erroresParseo.Count > 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                erroresParseo,
                "Los campos enviados no cumplen el formato esperado.",
                titulo: "Datos de creación inválidos");
            return;
        }

        // === Validación de PerfilDependienteId (RF-1) ===
        var erroresNegocio = new Dictionary<string, IEnumerable<string>>();

        if (req.PerfilDependienteId == Guid.Empty)
        {
            erroresNegocio["perfilDependienteId"] = ["Debe seleccionar un dependiente válido."];
        }

        // === Parseo y validación de TipoRecurrencia + IntervaloSemanas ===
        if (!Enum.TryParse<TipoRecurrencia>(req.TipoRecurrencia, ignoreCase: true, out var tipoRecurrencia))
        {
            erroresNegocio["tipoRecurrencia"] = ["Valor inválido. Use: Unica, Indefinida o Semanas."];
            tipoRecurrencia = TipoRecurrencia.Unica; // valor seguro para continuar validaciones
        }

        if (tipoRecurrencia == TipoRecurrencia.Semanas)
        {
            if (req.IntervaloSemanas is null || req.IntervaloSemanas < 1 || req.IntervaloSemanas > 24)
            {
                erroresNegocio["intervaloSemanas"] = ["Debe especificar un intervalo entre 1 y 24 semanas."];
            }
        }
        else
        {
            if (req.IntervaloSemanas is not null)
            {
                erroresNegocio["intervaloSemanas"] = ["El intervalo solo aplica para recurrencia semanal."];
            }
        }

        // === Validación de Tareas ===
        var tareasNormalizadas = new List<TareaTurnoItem>();
        if (req.Tareas is not null && req.Tareas.Count > 0)
        {
            if (req.Tareas.Count > 20)
            {
                erroresNegocio["tareas"] = ["Máximo 20 tareas permitidas por bloque."];
            }
            else
            {
                for (var i = 0; i < req.Tareas.Count; i++)
                {
                    var t = req.Tareas[i];
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
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        if (fecha!.Value < hoy)
            erroresNegocio["fecha"] = ["No se pueden crear bloques en fechas pasadas."];

        if (horaFin!.Value <= horaInicio!.Value)
            erroresNegocio["horaFin"] = ["La hora de fin debe ser posterior a la hora de inicio."];

        if (req.CuposMaximos < 1 || req.CuposMaximos > 5)
            erroresNegocio["cuposMaximos"] = ["Los cupos deben estar entre 1 y 5."];

        if (!string.IsNullOrWhiteSpace(req.Descripcion) && req.Descripcion.Length > 200)
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

        // === Tenancy clínica (RF-1 / BOLA) ===
        // El usuario autenticado debe tener un VinculoDependiente activo y
        // con rol CuidadorPrincipal sobre el dependiente indicado.
        var tienePermiso = await _dbContext.VinculosDependientes
            .AsNoTracking()
            .AnyAsync(v =>
                v.UsuarioId == usuarioId.Value &&
                v.PerfilDependienteId == req.PerfilDependienteId &&
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

        // === Persistencia ===
        var bloque = new BloqueTurno
        {
            Id = Guid.NewGuid(),
            Fecha = fecha.Value,
            HoraInicio = horaInicio.Value,
            HoraFin = horaFin.Value,
            CuposMaximos = req.CuposMaximos,
            Descripcion = req.Descripcion?.Trim(),
            PerfilDependienteId = req.PerfilDependienteId,
            TipoRecurrencia = tipoRecurrencia,
            IntervaloSemanas = tipoRecurrencia == TipoRecurrencia.Semanas ? req.IntervaloSemanas : null,
            Tareas = tareasNormalizadas,
            CreadoPorId = usuarioId.Value,
            FechaCreacion = DateTimeOffset.UtcNow
        };

        _dbContext.BloquesTurno.Add(bloque);
        await _dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new CrearBloqueResponseDto(bloque.Id, "Bloque de turno creado exitosamente."), ct);
    }
}
