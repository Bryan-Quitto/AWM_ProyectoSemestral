using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Agenda.Obtener;

public class ObtenerBloqueEndpoint : EndpointWithoutRequest<BloqueTurnoDto>
{
    private readonly AppDbContext _dbContext;

    public ObtenerBloqueEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Get("/api/agenda/{id}");
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

        var bloque = await _dbContext.BloquesTurno
            .AsNoTracking()
            .Include(b => b.CreadoPor)
            .Include(b => b.Reservas)
                .ThenInclude(r => r.Usuario)
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            AddError("El bloque de turno no fue encontrado.", "id");
            ThrowIfAnyErrors();
            return;
        }

        var reservasActivas = bloque.Reservas.Where(r => r.Activa).ToList();
        var miReserva = reservasActivas.FirstOrDefault(r => r.UsuarioId == usuarioId);
        var esMiBloque = bloque.CreadoPorId == usuarioId;
        var cuposDisponibles = bloque.CuposMaximos - reservasActivas.Count;

        var puedoReservar = !esMiBloque
            && !bloque.EstaVencido
            && cuposDisponibles > 0
            && miReserva == null;

        var dto = new BloqueTurnoDto(
            Id: bloque.Id,
            Fecha: bloque.Fecha.ToString("yyyy-MM-dd"),
            HoraInicio: bloque.HoraInicio.ToString("HH:mm:ss"),
            HoraFin: bloque.HoraFin.ToString("HH:mm:ss"),
            CuposMaximos: bloque.CuposMaximos,
            CuposDisponibles: cuposDisponibles,
            Descripcion: bloque.Descripcion,
            CreadoPor: new UsuarioResumenDto(
                bloque.CreadoPor.Id,
                $"{bloque.CreadoPor.Nombre} {bloque.CreadoPor.Apellido}".Trim()
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
            YaReservé: miReserva != null
        );

        await Send.OkAsync(dto, ct);
    }
}
