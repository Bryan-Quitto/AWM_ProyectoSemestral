using System.Security.Claims;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Features.Notificaciones;
using RACPD.Backend.Infrastructure;
using ProblemDetails = Microsoft.AspNetCore.Mvc.ProblemDetails;

namespace RACPD.Backend.Features.Alertas.Sos;

public sealed record DispararSosRequest(Guid? PerfilDependienteId);

public sealed record DispararSosResponse(
    Guid AlertaId,
    Guid PerfilDependienteId,
    string NombreDependiente,
    int CuidadoresNotificados,
    DateTimeOffset FechaEmision);

/// <summary>
/// Endpoint POST /api/alertas/sos — Persona 3 / Semana 6.
///
/// Identifica a familiares con rol 'Apoyo' (y CuidadorPrincipal si quien dispara
/// es Apoyo) vinculados al dependiente activo e inserta un mensaje de alta
/// prioridad tipo ALERTA_SOS_URGENTE en OutboxMensajes para despacho Push VAPID.
/// </summary>
public sealed class DispararSosEndpoint(AppDbContext db)
    : Endpoint<DispararSosRequest, DispararSosResponse>
{
    public override void Configure()
    {
        Post("/api/alertas/sos");
        Roles(
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
        Description(x => x
            .Produces<DispararSosResponse>(201)
            .Produces<ProblemDetails>(401)
            .Produces<ProblemDetails>(403)
            .Produces<ProblemDetails>(404));
    }

    public override async Task HandleAsync(DispararSosRequest req, CancellationToken ct)
    {
        var usuarioIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(usuarioIdStr) || !Guid.TryParse(usuarioIdStr, out var usuarioId))
        {
            await ProblemDetailsHelper.EnviarNoAutenticadoAsync(HttpContext);
            return;
        }

        // One Trip Pattern: localizar el vínculo activo del usuario y el nombre del dependiente.
        var vinculoUsuario = await db.VinculosDependientes
            .AsNoTracking()
            .Where(v => v.UsuarioId == usuarioId && v.Activo
                && (!req.PerfilDependienteId.HasValue || v.PerfilDependienteId == req.PerfilDependienteId.Value))
            .OrderBy(v => v.FechaAsignacion)
            .Select(v => new
            {
                v.PerfilDependienteId,
                NombreDependiente = v.PerfilDependiente.NombreCompleto
            })
            .FirstOrDefaultAsync(ct);

        if (vinculoUsuario is null)
        {
            var mensaje = req.PerfilDependienteId.HasValue
                ? "No tienes un vínculo activo con el dependiente indicado."
                : "No tienes un dependiente activo asignado para emitir una alerta SOS.";
            await ProblemDetailsHelper.EnviarNoEncontradoAsync(HttpContext, mensaje, "dependiente-no-vinculado");
            return;
        }

        // Contar los destinatarios activos elegibles (rol Apoyo o CuidadorPrincipal, excluyendo al emisor).
        var cuidadoresANotificar = await db.VinculosDependientes
            .AsNoTracking()
            .CountAsync(v =>
                v.PerfilDependienteId == vinculoUsuario.PerfilDependienteId
                && v.Activo
                && v.UsuarioId != usuarioId
                && (v.RolEnDependiente == RolEnDependiente.Apoyo || v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal)
                && v.Usuario.Estado == EstadoUsuario.Activo, ct);

        var alertaId = Guid.NewGuid();
        var ahora = DateTimeOffset.UtcNow;

        var carga = new CargaAlertaSos(
            alertaId,
            vinculoUsuario.PerfilDependienteId,
            usuarioId,
            ahora);

        db.OutboxMensajes.Add(new OutboxMensaje
        {
            Id = alertaId,
            VersionCarga = 1,
            Tipo = "ALERTA_SOS_URGENTE",
            PayloadJson = global::System.Text.Json.JsonSerializer.Serialize(carga),
            Fecha = ahora,
            Procesado = false,
            DestinatariosResueltos = false
        });

        await db.SaveChangesAsync(ct);

        var respuesta = new DispararSosResponse(
            alertaId,
            vinculoUsuario.PerfilDependienteId,
            vinculoUsuario.NombreDependiente,
            cuidadoresANotificar,
            ahora);

        await Send.ResponseAsync(respuesta, StatusCodes.Status201Created, ct);
    }
}
