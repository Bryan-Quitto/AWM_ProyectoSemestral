using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using FastEndpoints;
using ProblemDetails = Microsoft.AspNetCore.Mvc.ProblemDetails;
using Microsoft.Extensions.Options;
namespace RACPD.Backend.Features.Notificaciones;
public sealed record RespuestaConfiguracionPush(bool Disponible, string? ClavePublicaVapid, bool SuscripcionActiva);
public sealed class SolicitudConfiguracionPush { [QueryParam] public Guid? IdSuscripcion { get; set; } }
public sealed class ConfiguracionNotificacionesEndpoint(IOptions<OpcionesPush> opciones, AppDbContext db) : Endpoint<SolicitudConfiguracionPush, RespuestaConfiguracionPush>
{
    public override void Configure()
    {
        Get("/api/notificaciones/configuracion");
        Description(x => x.Produces<RespuestaConfiguracionPush>(200).Produces<ProblemDetails>(401).Produces<ProblemDetails>(403));
    }
    public override async Task HandleAsync(SolicitudConfiguracionPush req, CancellationToken ct)
    {
        if (!ErroresPush.Identificar(User, out var usuarioId)) { await ErroresPush.Enviar(HttpContext, 401, "No se pudo identificar tu cuenta."); return; }
        var o = opciones.Value;
        var activa = req.IdSuscripcion.HasValue && await db.SuscripcionesPush.AsNoTracking().AnyAsync(x => x.Id == req.IdSuscripcion && x.UsuarioId == usuarioId && x.Activa, ct);
        await Send.OkAsync(new RespuestaConfiguracionPush(o.Disponible, o.Disponible ? o.ClavePublica : null, activa), ct);
    }
}
