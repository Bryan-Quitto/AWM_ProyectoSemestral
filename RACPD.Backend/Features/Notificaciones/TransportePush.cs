using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Extensions.Options;
using RACPD.Backend.Domain.Entities;
using WebPush;
namespace RACPD.Backend.Features.Notificaciones;
public sealed record ResultadoEnvioPush(int? Codigo, string? Error, TimeSpan? Espera = null);
public sealed class TransportePush(IHttpClientFactory fabrica, IOptions<OpcionesPush> opciones)
{
    public async Task<ResultadoEnvioPush> Enviar(SuscripcionPush suscripcion, Guid mensajeId, string ruta, CancellationToken ct)
    {
        var o = opciones.Value;
        if (!o.DestinoPermitido(suscripcion.UrlDestino)) return new(null, "DestinoNoPermitido");
        using var cliente = fabrica.CreateClient("push");
        using var web = new WebPushClient(cliente);
        var aviso = new AvisoPush(mensajeId.ToString(), "RACPD", "Hay una actualización importante en tu red de cuidados. Abre la aplicación para revisarla.", ruta);
        try
        {
            using var solicitud = web.GenerateRequestDetails(new PushSubscription(suscripcion.UrlDestino, suscripcion.ClavePublica, suscripcion.SecretoAutenticacion),
            JsonSerializer.Serialize(aviso, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
            new Dictionary<string, object> { ["vapidDetails"] = new VapidDetails(o.Asunto, o.ClavePublica, o.ClavePrivada), ["TTL"] = Math.Clamp(o.TtlSegundos, 1, 86400) });
            using var respuesta = await cliente.SendAsync(solicitud, ct);
            var espera = respuesta.Headers.RetryAfter?.Delta;
            if (respuesta.Headers.RetryAfter?.Date is { } fecha) espera = fecha - DateTimeOffset.UtcNow;
            var error = respuesta.IsSuccessStatusCode ? null : respuesta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
                ? "ConfiguracionVapidRechazada" : "ProveedorRechazo";
            return new((int)respuesta.StatusCode, error, espera);
        }
        catch (ArgumentException) { return new(null, "SuscripcionInvalida"); }
        catch (global::System.Security.Cryptography.CryptographicException) { return new(null, "SuscripcionInvalida"); }
        catch (HttpRequestException) { return new(null, "RedNoDisponible"); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return new(null, "TiempoAgotado"); }
    }
    public static SocketsHttpHandler CrearManejador() => new()
    {
        AllowAutoRedirect = false, UseProxy = false,
        ConnectCallback = async (contexto, ct) =>
        {
            var direcciones = await Dns.GetHostAddressesAsync(contexto.DnsEndPoint.Host, ct);
            foreach (var ip in direcciones.Where(OpcionesPush.DireccionPublica))
            {
                var socket = new Socket(ip.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
                try { await socket.ConnectAsync(new IPEndPoint(ip, contexto.DnsEndPoint.Port), ct); return new NetworkStream(socket, ownsSocket: true); }
                catch { socket.Dispose(); }
            }
            throw new HttpRequestException("No existe una dirección pública accesible para el proveedor.");
        }
    };
}
