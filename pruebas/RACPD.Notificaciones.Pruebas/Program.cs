using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Features.Notificaciones;
using WebPush;

var verificaciones = 0;
void Verificar(bool condicion, string mensaje)
{
    if (!condicion) throw new InvalidOperationException(mensaje);
    verificaciones++;
}
var claves = VapidHelper.GenerateVapidKeys();
var opciones = new OpcionesPush { ClavePublica = claves.PublicKey, ClavePrivada = claves.PrivateKey, Asunto = "mailto:pruebas@example.com" };
Verificar(opciones.Disponible, "VAPID válido");
Verificar(!new OpcionesPush().Disponible, "Sin configuración no se habilita el servicio");
foreach (var destino in new[] { "http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.ejemplo.org/a", "https://usuario@fcm.googleapis.com/a", "https://fcm.googleapis.com:8443/a", "https://localhost/a", "https://fcm.googleapis.com/a#fragmento", "https://169.254.169.254/latest/meta-data" })
    Verificar(!opciones.DestinoPermitido(destino), "Debe bloquear destino " + destino);
Verificar(opciones.DestinoPermitido("https://fcm.googleapis.com/envio/prueba"), "Proveedor permitido");
foreach (var ip in new[] { "127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1" })
    Verificar(!OpcionesPush.DireccionPublica(IPAddress.Parse(ip)), "Debe bloquear dirección " + ip);
Verificar(OpcionesPush.DireccionPublica(IPAddress.Parse("8.8.8.8")), "IPv4 pública");
Verificar(OpcionesPush.DireccionPublica(IPAddress.Parse("2606:4700:4700::1111")), "IPv6 pública");
Verificar(!OpcionesPush.ClaveValida(WebEncoders.Base64UrlEncode(new byte[65]), 65), "Rechaza punto inválido");
Verificar(!OpcionesPush.ClaveValida(null, 65), "Rechaza clave nula");
using var curva = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
var punto = curva.ExportParameters(false).Q;
var publica = new byte[65]; publica[0] = 4;
(punto.X ?? throw new InvalidOperationException("Falta X")).CopyTo(publica, 1);
(punto.Y ?? throw new InvalidOperationException("Falta Y")).CopyTo(publica, 33);
var suscripcion = new SuscripcionPush { UrlDestino = "https://fcm.googleapis.com/envio/prueba", ClavePublica = WebEncoders.Base64UrlEncode(publica), SecretoAutenticacion = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(16)) };
var fabrica = new FabricaPrueba();
var transporte = new TransportePush(fabrica, Options.Create(opciones));
foreach (var codigo in new[] { 201, 404, 410, 429, 500 })
{
    fabrica.Manejador.Codigo = codigo;
    var resultado = await transporte.Enviar(suscripcion, Guid.NewGuid(), "/agenda", CancellationToken.None);
    Verificar(resultado.Codigo == codigo, "Conserva código del proveedor " + codigo);
    if (codigo == 429) Verificar(resultado.Espera == TimeSpan.FromSeconds(120), "Respeta Retry-After");
}
Verificar(fabrica.Manejador.Cifrado, "Envía carga cifrada con VAPID y TTL");
var antes = fabrica.Manejador.Llamadas;
suscripcion.UrlDestino = "https://127.0.0.1/a";
var bloqueado = await transporte.Enviar(suscripcion, Guid.NewGuid(), "/agenda", CancellationToken.None);
Verificar(bloqueado.Error == "DestinoNoPermitido" && fabrica.Manejador.Llamadas == antes, "SSRF bloqueado antes de enviar");
using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=localhost;Database=sin_conexion").Options))
{
    var sql = db.Database.GenerateCreateScript();
    Verificar(sql.Contains("SuscripcionesPush") && sql.Contains("EntregasPush"), "Modelo incluye tablas push");
    Verificar((db.Model.FindEntityType(typeof(EntregaPush)) ?? throw new InvalidOperationException("Falta entidad")).GetIndexes().Any(i => i.IsUnique && i.Properties.Count == 2), "Restricción de idempotencia por dispositivo");
}
Console.WriteLine($"Correcto: {verificaciones} verificaciones de seguridad, modelo y transporte cifrado.");
await IntegracionPostgres.Ejecutar();

sealed class FabricaPrueba : IHttpClientFactory
{
    public ManejadorPrueba Manejador { get; } = new();
    public HttpClient CreateClient(string nombre) => new(Manejador, disposeHandler: false);
}
sealed class ManejadorPrueba : HttpMessageHandler
{
    public int Codigo { get; set; }
    public int Llamadas { get; private set; }
    public bool Cifrado { get; private set; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage solicitud, CancellationToken ct)
    {
        Llamadas++;
        var contenido = solicitud.Content == null ? [] : await solicitud.Content.ReadAsByteArrayAsync(ct);
        Cifrado = solicitud.Method == HttpMethod.Post && solicitud.Headers.Contains("Authorization") && solicitud.Headers.Contains("TTL")
            && contenido.Length > 0 && !System.Text.Encoding.UTF8.GetString(contenido).Contains("Hay una actualización");
        var respuesta = new HttpResponseMessage((HttpStatusCode)Codigo);
        if (Codigo == 429) respuesta.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(120));
        return respuesta;
    }
}
