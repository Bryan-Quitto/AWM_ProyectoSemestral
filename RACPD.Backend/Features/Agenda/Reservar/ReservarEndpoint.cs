using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Agenda.Reservar;

public record Response(ReservaExitosaDto Data);

public class ReservarEndpoint : EndpointWithoutRequest<Response>
{
    private readonly AppDbContext _dbContext;

    public ReservarEndpoint(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override void Configure()
    {
        Post("/api/agenda/{id}/reservar");
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
            .Include(b => b.Reservas)
            .FirstOrDefaultAsync(b => b.Id == bloqueId, ct);

        if (bloque == null)
        {
            AddError("El bloque de turno no fue encontrado.", "id");
            ThrowIfAnyErrors();
            return;
        }

        // R2: No reservar su propio bloque
        if (bloque.CreadoPorId == usuarioId)
        {
            AddError("No puedes reservar tu propio bloque de turno.");
            ThrowIfAnyErrors();
            return;
        }

        // R3: No bloques pasados
        if (bloque.EstaVencido)
        {
            AddError("No se puede reservar un bloque en fecha pasada.");
            ThrowIfAnyErrors();
            return;
        }

        // R5: No doble reserva
        var yaReservo = bloque.Reservas.Any(r => r.UsuarioId == usuarioId && r.Activa);
        if (yaReservo)
        {
            AddError("Ya tienes una reserva activa para este bloque.");
            ThrowIfAnyErrors();
            return;
        }

        // R6: Cupos disponibles
        var cuposDisponibles = bloque.CuposMaximos - bloque.Reservas.Count(r => r.Activa);
        if (cuposDisponibles <= 0)
        {
            AddError("Este bloque ya no tiene cupos disponibles.");
            ThrowIfAnyErrors();
            return;
        }

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

        var reserva = new ReservaTurno
        {
            Id = Guid.NewGuid(),
            BloqueTurnoId = bloqueId,
            UsuarioId = usuarioId,
            FechaReserva = DateTimeOffset.UtcNow,
            Activa = true
        };

        _dbContext.ReservasTurno.Add(reserva);
        await _dbContext.SaveChangesAsync(ct);

        var respuesta = new ReservaExitosaDto(
            reserva.Id,
            bloqueId,
            reserva.FechaReserva
        );

        await Send.OkAsync(new Response(respuesta), ct);
    }
}
