using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Agenda.Listar;

public record Response(IReadOnlyList<BloqueTurnoDto> Data);

/// <summary>
/// Endpoint GET /api/agenda — Lista bloques de turno con proyección de ocurrencias.
/// Persona 1 / Semana 2:
/// - Algoritmo de proyección en memoria para <see cref="TipoRecurrencia.Semanas"/>
///   (rango válido: 1..24 semanas). <see cref="TipoRecurrencia.Indefinida"/>
///   eliminado del enum en spec-007 §10.
/// - Sin duplicar registros en Postgres: un único bloque maestro puede materializar
///   múltiples ocurrencias dentro del rango <c>[fechaDesde, fechaHasta]</c>.
/// - Filtros <c>MisBloques</c> / <c>MisReservas</c> / <c>Disponibles</c> se aplican
///   sobre la lista ya proyectada (en memoria).
/// - Identificadores expuestos: <c>Id</c> (compat, apunta al maestro),
///   <c>IdBloqueMaestro</c> (explícito) y <c>IdOcurrencia</c> (determinista).
/// Errores: RFC 7807 estricto vía <see cref="ProblemDetailsHelper"/>.
/// </summary>
public class ListarBloquesEndpoint : EndpointWithoutRequest<Response>
{
    /// <summary>
    /// Tope defensivo de iteraciones para evitar bucles infinitos accidentales
    /// si una fecha base errónea pasa los filtros. Cubre ≈ 7 años de
    /// repeticiones semanales (52 × 7 = 364).
    /// </summary>
    private const int TopeOcurrenciasIndefinida = 366;

    /// <summary>
    /// Tope defensivo para recurrencia <c>Semanas</c>: 24 semanas × 4 años.
    /// </summary>
    private const int TopeOcurrenciasSemanas = 96;

    /// <summary>
    /// Rango por defecto cuando el cliente no envía `fechaDesde` / `fechaHasta`.
    /// Antes: 90 días continuos (causaba confusión al cuidador: mezclaba
    /// varios meses en una sola vista).
    /// Ahora: mes natural en Ecuador (primer día del mes → último día del mes).
    /// Esto alinea el default con la vista del calendario mensual de la UI y
    /// respeta la regla "un mes a la vez" del SPEC original (agenda.spec 004).
    /// Coherente con el principio "Zero-Wait Policy" del SKILLS.md: el cuidador
    /// ve el mes completo de un solo GET sin pedirlo explícito.
    /// </summary>
    private const int RangoPorDefectoDias = 90; // Solo defensivo; ver RangoPorDefectoModo.

    /// <summary>
    /// Tope absoluto del rango permitido en una una request. Evita que un cliente
    /// malicioso o despistado pida 10 años y reciba miles de ocurrencias.
    /// </summary>
    private const int RangoMaximoDias = 365;

    private readonly AppDbContext _dbContext;

    public ListarBloquesEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/agenda");
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

        var rolClaim = User.FindFirstValue(ClaimTypes.Role)
            ?? User.FindFirstValue("role");

        var esPrincipal = rolClaim?.Equals(Rol.CuidadorPrincipal.ToString(), StringComparison.OrdinalIgnoreCase) == true;
        var esAdministrador = rolClaim?.Equals(Rol.AdministradorSistema.ToString(), StringComparison.OrdinalIgnoreCase) == true;

        // Parámetros de filtro (todos opcionales)
        var filtro = Query<string>("filtro", isRequired: false) ?? "Todos";

        // SKILLS.md §3: rango de búsqueda en huso Ecuador.
        // Por defecto: mes natural en Ecuador (primer día → último día del mes).
        // Esto alinea el GET con la vista de calendario mensual del Frontend
        // y respeta la regla "un mes a la vez" del SPEC original.
        var hoy = ZonaEcuador.HoyLocal;
        var inicioMes = new DateOnly(hoy.Year, hoy.Month, 1);
        var finMes = inicioMes.AddMonths(1).AddDays(-1);
        var fechaDesde = inicioMes;
        var fechaHasta = finMes;

        // Intentar parsear fechas si vienen como query params.
        // Cualquier fecha válida enviada por el cliente tiene prioridad sobre
        // el default de mes natural (soporta avance/retroceso de mes en la UI).
        var fechaDesdeStr = Query<string>("fechaDesde", isRequired: false);
        var fechaHastaStr = Query<string>("fechaHasta", isRequired: false);

        var hayDesdeCliente = false;
        var hayHastaCliente = false;
        if (!string.IsNullOrEmpty(fechaDesdeStr) && DateOnly.TryParse(fechaDesdeStr, out var parsedDesde))
        {
            fechaDesde = parsedDesde;
            hayDesdeCliente = true;
        }
        if (!string.IsNullOrEmpty(fechaHastaStr) && DateOnly.TryParse(fechaHastaStr, out var parsedHasta))
        {
            fechaHasta = parsedHasta;
            hayHastaCliente = true;
        }

        // Si el cliente solo manda uno de los dos extremos, mantener el mes
        // natural desde/hasta el lado no enviado para no romper la UI.
        if (hayDesdeCliente && !hayHastaCliente)
        {
            fechaHasta = fechaDesde.AddMonths(1).AddDays(-1);
        }
        else if (!hayDesdeCliente && hayHastaCliente)
        {
            fechaDesde = new DateOnly(fechaHasta.Year, fechaHasta.Month, 1);
        }

        // Garantizar coherencia del rango.
        if (fechaHasta < fechaDesde)
        {
            (fechaDesde, fechaHasta) = (fechaHasta, fechaDesde);
        }

        // Tope absoluto: un cliente no puede pedir más de 365 días para evitar
        // respuestas gigantes. Si pide más, recortamos silenciosamente al tope.
        // La paginación real del lado cliente (lazy render / scroll) manejará
        // el excedente.
        if (fechaHasta.DayNumber - fechaDesde.DayNumber > RangoMaximoDias)
        {
            fechaHasta = fechaDesde.AddDays(RangoMaximoDias);
        }

        // === Visibilidad por dependiente (Cero-Indulgencia: tenancy) ===
        // Antes la query traía TODOS los bloques del sistema, dejando al usuario
        // ver turnos de dependientes donde no estaba vinculado. Bug crítico
        // de aislamiento multi-cuidador.
        //
        // Regla aplicada (alineada con SKILLS.md §"Huso horario Ecuador" y con
        // spec-004 §1.3):
        //  - CuidadorPrincipal: puede ver bloques cuyo PerfilDependienteId sea null
        //    (legado pre-FK) O esté vinculado a él vía VinculoDependiente activo.
        //  - Apoyo: idéntico al Principal. Si no tiene vínculos, no ve nada
        //    (coherente con la regla "no leak entre sesiones").
        //  - AdministradorSistema: bypass del filtro (rol admin) — pero no tiene
        //    notificaciones operativas porque la agenda no es su responsabilidad.
        var idsDependientesVisibles = Array.Empty<Guid>();
        if (!esAdministrador)
        {
            idsDependientesVisibles = await _dbContext.VinculosDependientes
                .AsNoTracking()
                .Where(v => v.UsuarioId == usuarioId && v.Activo)
                .Select(v => v.PerfilDependienteId)
                .ToArrayAsync(ct);
        }

        // === Trip único a Postgres: candidatas para proyección ===
        // - Unica dentro de [fechaDesde, fechaHasta]
        // - Semanas cuya fecha base <= fechaHasta
        // (TipoRecurrencia.Indefinida eliminado del enum en spec-007 §10)
        // Filtro adicional por visibilidad: solo bloques cuyo PerfilDependiente
        // pertenezca al set del usuario (o sea null en datos legacy).
        IQueryable<BloqueTurno> queryCandidatas = _dbContext.BloquesTurno
            .AsNoTracking()
            .Include(b => b.CreadoPor)
            .Include(b => b.PerfilDependiente)
            .Include(b => b.Reservas)
                .ThenInclude(r => r.Usuario)
            .Where(b =>
                (b.TipoRecurrencia == TipoRecurrencia.Unica
                    && b.Fecha >= fechaDesde && b.Fecha <= fechaHasta)
                || (b.TipoRecurrencia == TipoRecurrencia.Semanas
                    && b.Fecha <= fechaHasta));

        if (!esAdministrador)
        {
            // PerfilDependienteId es NOT NULL desde la migracion
            // HacerPerfilDependienteIdObligatorio. Si el usuario no tiene
            // vínculos activos, idsDependientesVisibles queda vacío y la
            // sub-query Contains() no devuelve nada (cero resultados, que es
            // lo correcto: sin vínculos = sin agenda visible).
            queryCandidatas = queryCandidatas.Where(b =>
                idsDependientesVisibles.Contains(b.PerfilDependienteId));
        }

        var candidatas = await queryCandidatas.ToListAsync(ct);

        // === Proyección en memoria ===
        var ocurrencias = new List<(BloqueTurno Maestro, DateOnly FechaOc)>();

        foreach (var b in candidatas)
        {
            switch (b.TipoRecurrencia)
            {
                case TipoRecurrencia.Unica:
                    if (b.Fecha >= fechaDesde && b.Fecha <= fechaHasta)
                    {
                        ocurrencias.Add((b, b.Fecha));
                    }
                    break;

                case TipoRecurrencia.Semanas
                    when b.IntervaloSemanas is int n && n >= 1 && n <= 24:
                    {
                        var paso = n * 7;
                        var iter = 0;
                        for (var d = b.Fecha; d <= fechaHasta; d = d.AddDays(paso))
                        {
                            if (d >= fechaDesde)
                            {
                                ocurrencias.Add((b, d));
                                if (++iter > TopeOcurrenciasSemanas)
                                {
                                    break;
                                }
                            }
                        }
                    }
                    break;

                // TipoRecurrencia.Semanas con IntervaloSemanas fuera de rango:
                // ignorado silenciosamente. La validación en Crear/Editar ya
                // garantiza el rango 1..24; defensa por si llega dato sucio.
                //
                // TipoRecurrencia.Indefinida eliminado del enum (spec-007 §10).
                // Si llegara un valor legacy desde la BD por una migración pendiente,
                // simplemente no se proyecta (cae en default del switch). El TOPE de
                // iteraciones anterior (TopeOcurrenciasIndefinida) ya no se usa pero
                // se conserva en el código como defensa histórica.
            }
        }

        // === Filtros en memoria sobre la lista proyectada ===
        if (filtro == "MisBloques" && esPrincipal)
        {
            ocurrencias = ocurrencias.Where(o => o.Maestro.CreadoPorId == usuarioId).ToList();
        }
        else if (filtro == "MisReservas")
        {
            ocurrencias = ocurrencias
                .Where(o => o.Maestro.Reservas.Any(r => r.Activa && r.UsuarioId == usuarioId))
                .ToList();
        }
        else if (filtro == "Disponibles")
        {
            ocurrencias = ocurrencias
                .Where(o => o.Maestro.CuposMaximos > o.Maestro.Reservas.Count(r => r.Activa))
                .ToList();
        }

        // === Mapeo a DTO con orden estable ===
        var bloquesDto = ocurrencias
            .OrderBy(o => o.FechaOc)
            .ThenBy(o => o.Maestro.HoraInicio)
            .Select(o =>
            {
                var b = o.Maestro;
                var reservasActivas = b.Reservas.Where(r => r.Activa).ToList();
                var miReserva = reservasActivas.FirstOrDefault(r => r.UsuarioId == usuarioId);
                var esMiBloque = b.CreadoPorId == usuarioId;
                var cuposDisponibles = b.CuposMaximos - reservasActivas.Count;
                var puedoReservar = !esMiBloque
                    && !b.EstaVencido
                    && cuposDisponibles > 0
                    && miReserva == null;
                var idOcurrencia = OcurrenciaIdHelper.CalcularIdOcurrencia(b.Id, o.FechaOc);

                return new BloqueTurnoDto(
                    Id: b.Id,
                    IdBloqueMaestro: b.Id,
                    IdOcurrencia: idOcurrencia,
                    Fecha: o.FechaOc.ToString("yyyy-MM-dd"),
                    HoraInicio: b.HoraInicio.ToString("HH:mm:ss"),
                    HoraFin: b.HoraFin.ToString("HH:mm:ss"),
                    CuposMaximos: b.CuposMaximos,
                    CuposDisponibles: cuposDisponibles,
                    Descripcion: b.Descripcion,
                    CreadoPor: new UsuarioResumenDto(
                        b.CreadoPor.Id,
                        $"{b.CreadoPor.Nombre} {b.CreadoPor.Apellido}".Trim()
                    ),
                    Reservas: reservasActivas.Select(r => new ReservaTurnoDto(
                        r.Id,
                        new UsuarioResumenDto(
                            r.Usuario.Id,
                            $"{r.Usuario.Nombre} {r.Usuario.Apellido}".Trim()
                        ),
                        r.UsuarioId == usuarioId
                    )).ToList(),
                    PuedoReservar: puedoReservar,
                    YaReservé: miReserva != null,
                    // === Persona 1 / Semana 1 ===
                    PerfilDependienteId: b.PerfilDependienteId,
                    NombreDependiente: b.PerfilDependiente?.NombreCompleto ?? string.Empty,
                    TipoRecurrencia: b.TipoRecurrencia.ToString(),
                    IntervaloSemanas: b.IntervaloSemanas,
                    Tareas: (b.Tareas ?? new List<TareaTurnoItem>())
                        .OrderBy(t => t.Orden)
                        .Select(t => new TareaTurnoDto(t.Id, t.Descripcion, t.Orden))
                        .ToList()
                );
            }).ToList();

        await Send.OkAsync(new Response(bloquesDto), ct);
    }
}