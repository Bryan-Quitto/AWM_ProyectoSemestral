using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.DirectorioRelevos.Sembrar;

/// <summary>
/// Endpoint opcional para poblar el Directorio de Relevos con datos de
/// prueba. Idempotente: si ya hay entradas activas para el dependiente,
/// no duplica.
///
/// Solo accesible para AdministradorSistema.
/// Pensado para entorno de desarrollo. En producción se deshabilita
/// por la política de Roles o se elimina este endpoint.
///
/// Errores: RFC 7807 vía ProblemDetailsHelper.
/// </summary>
public class SembrarDirectorioRelevosEndpoint
    : EndpointWithoutRequest<SembrarDirectorioRelevosResponse>
{
    private readonly AppDbContext _db;

    public SembrarDirectorioRelevosEndpoint(AppDbContext db)
    {
        _db = db;
    }

    public override void Configure()
    {
        Post("/api/directorio-relevos/sembrar");
        Roles(Rol.AdministradorSistema.ToString());
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        // Toma el primer perfil dependiente activo del sistema.
        var primerPerfil = await _db.PerfilesDependientes
            .AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.NombreCompleto)
            .FirstOrDefaultAsync(ct);

        if (primerPerfil is null)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "No existen perfiles dependientes activos para sembrar.",
                tipoRecurso: "sin-perfil-dependiente");
            return;
        }

        // Toma los primeros 5 usuarios con Rol.Apoyo y Estado.Activo.
        var usuariosApoyo = await _db.Usuarios
            .AsNoTracking()
            .Where(u => u.Rol == Rol.Apoyo && u.Estado == EstadoUsuario.Activo)
            .OrderBy(u => u.Apellido).ThenBy(u => u.Nombre)
            .Take(5)
            .ToListAsync(ct);

        if (usuariosApoyo.Count == 0)
        {
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(
                HttpContext,
                "No hay usuarios con Rol.Apoyo activos para vincular al directorio.",
                tipoRecurso: "sin-usuarios-apoyo");
            return;
        }

        var nombresDemo = new[]
        {
            "María Pérez",
            "Juan Rodríguez",
            "Ana Gómez",
            "Luis Mendoza",
            "Sofía Castro"
        };

        var telefonosDemo = new[]
        {
            "+593991234567",
            "+593992345678",
            "+593993456789",
            "+593994567890",
            "+593995678901"
        };

        var estadosDemo = new[]
        {
            EstadoDirectorioRelevo.Disponible,
            EstadoDirectorioRelevo.Disponible,
            EstadoDirectorioRelevo.NoDisponible,
            EstadoDirectorioRelevo.Disponible,
            EstadoDirectorioRelevo.NoDisponible
        };

        // Ya existen activos para este perfil?
        var existentes = await _db.DirectorioRelevos
            .Where(d => d.PerfilDependienteId == primerPerfil.Id && d.Activo)
            .CountAsync(ct);

        if (existentes > 0)
        {
            await Send.OkAsync(
                new SembrarDirectorioRelevosResponse(
                    Insertados: 0,
                    Mensaje: $"El directorio del dependiente '{primerPerfil.NombreCompleto}' ya tiene {existentes} entradas activas. No se duplicaron."),
                ct);
            return;
        }

        var ahora = DateTimeOffset.UtcNow;
        for (var i = 0; i < usuariosApoyo.Count; i++)
        {
            _db.DirectorioRelevos.Add(new DirectorioRelevo
            {
                Id = Guid.NewGuid(),
                PerfilDependienteId = primerPerfil.Id,
                UsuarioApoyoId = usuariosApoyo[i].Id,
                Nombre = nombresDemo[i % nombresDemo.Length],
                Telefono = telefonosDemo[i % telefonosDemo.Length],
                Estado = estadosDemo[i % estadosDemo.Length],
                Listado = true,
                CreatedAt = ahora,
                Activo = true
            });
        }

        await _db.SaveChangesAsync(ct);

        await Send.OkAsync(
            new SembrarDirectorioRelevosResponse(
                Insertados: usuariosApoyo.Count,
                Mensaje: $"Se sembraron {usuariosApoyo.Count} entradas en el directorio del dependiente '{primerPerfil.NombreCompleto}'."),
            ct);
    }
}

public record SembrarDirectorioRelevosResponse(
    int Insertados,
    string Mensaje
);
