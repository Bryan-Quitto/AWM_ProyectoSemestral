using FastEndpoints;
using ProblemDetails = Microsoft.AspNetCore.Mvc.ProblemDetails;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
namespace RACPD.Backend.Features.Notificaciones;
public sealed class SolicitudDesuscripcionPush { public Guid IdSuscripcion { get; set; } }
public sealed class DesuscribirNotificacionesEndpoint(AppDbContext db) : Endpoint<SolicitudDesuscripcionPush, RespuestaSuscripcionPush>
{
    public override void Configure()
    {
        Delete("/api/notificaciones/desuscribir");
        Description(x => x.Accepts<SolicitudDesuscripcionPush>("application/json").Produces<RespuestaSuscripcionPush>(200).Produces<ProblemDetails>(400).Produces<ProblemDetails>(401).Produces<ProblemDetails>(403));
    }
    public override async Task HandleAsync(SolicitudDesuscripcionPush req, CancellationToken ct)
    {
        if (!ErroresPush.Identificar(User, out var usuarioId)) { await ErroresPush.Enviar(HttpContext, 401, "No se pudo identificar tu cuenta."); return; }
        if (req.IdSuscripcion == Guid.Empty) { await ErroresPush.Enviar(HttpContext, 400, "Falta el identificador de suscripción."); return; }
        var resultado = await db.SuscripcionesPush.Where(x => x.Id == req.IdSuscripcion && x.UsuarioId == usuarioId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Activa, false).SetProperty(x => x.FechaActualizacion, DateTimeOffset.UtcNow), ct);
        if (resultado == 0) { await ErroresPush.Enviar(HttpContext, 403, "La suscripción no pertenece a tu cuenta."); return; }
        await Send.OkAsync(new RespuestaSuscripcionPush(req.IdSuscripcion, false), ct);
    }
}
