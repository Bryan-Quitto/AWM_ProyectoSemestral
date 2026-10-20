using System.Security.Cryptography;
using System.Text;
using FastEndpoints;
using ProblemDetails = Microsoft.AspNetCore.Mvc.ProblemDetails;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
namespace RACPD.Backend.Features.Notificaciones;
public sealed class SolicitudSuscripcionPush
{
    public string UrlDestino { get; set; } = string.Empty;
    public string ClavePublica { get; set; } = string.Empty;
    public string SecretoAutenticacion { get; set; } = string.Empty;
}
public sealed class SuscribirNotificacionesEndpoint(AppDbContext db, IOptions<OpcionesPush> opciones) : Endpoint<SolicitudSuscripcionPush, RespuestaSuscripcionPush>
{
    public override void Configure()
    {
        Post("/api/notificaciones/suscribir");
        Description(x => x.Accepts<SolicitudSuscripcionPush>("application/json").Produces<RespuestaSuscripcionPush>(200).Produces<ProblemDetails>(400).Produces<ProblemDetails>(401)
            .Produces<ProblemDetails>(403).Produces<ProblemDetails>(409).Produces<ProblemDetails>(503));
    }
    public override async Task HandleAsync(SolicitudSuscripcionPush req, CancellationToken ct)
    {
        if (!ErroresPush.Identificar(User, out var usuarioId)) { await ErroresPush.Enviar(HttpContext, 401, "No se pudo identificar tu cuenta."); return; }
        if (!await db.Usuarios.AnyAsync(x => x.Id == usuarioId && x.Estado == EstadoUsuario.Activo, ct))
        { await ErroresPush.Enviar(HttpContext, 403, "Tu cuenta no está activa."); return; }
        if (!opciones.Value.Disponible) { await ErroresPush.Enviar(HttpContext, 503, "Las notificaciones todavía no están configuradas."); return; }
        if (!opciones.Value.DestinoPermitido(req.UrlDestino) || !OpcionesPush.ClaveValida(req.ClavePublica, 65)
            || !OpcionesPush.ClaveValida(req.SecretoAutenticacion, 16))
        { await ErroresPush.Enviar(HttpContext, 400, "La suscripción del navegador no es válida o su proveedor no está permitido."); return; }
        var huella = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(req.UrlDestino)));
        var suscripcion = await db.SuscripcionesPush.SingleOrDefaultAsync(x => x.HuellaDestino == huella, ct);
        if (suscripcion != null && (suscripcion.UsuarioId != usuarioId || suscripcion.UrlDestino != req.UrlDestino))
        { await ErroresPush.Enviar(HttpContext, 409, "Este navegador está asociado a otra cuenta. Desvincúlalo antes de continuar."); return; }
        if (suscripcion == null)
        {
            suscripcion = new SuscripcionPush { UsuarioId = usuarioId, UrlDestino = req.UrlDestino, HuellaDestino = huella };
            db.SuscripcionesPush.Add(suscripcion);
        }
        suscripcion.ClavePublica = req.ClavePublica;
        suscripcion.SecretoAutenticacion = req.SecretoAutenticacion;
        suscripcion.Activa = true;
        suscripcion.FechaActualizacion = DateTimeOffset.UtcNow;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        { await ErroresPush.Enviar(HttpContext, 409, "La suscripción cambió simultáneamente. Vuelve a intentarlo."); return; }
        await Send.OkAsync(new RespuestaSuscripcionPush(suscripcion.Id, true), ct);
    }
}
