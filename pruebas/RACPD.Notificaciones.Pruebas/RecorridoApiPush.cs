using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Features.Notificaciones;
using RACPD.Backend.Infrastructure;
using WebPush;

static class RecorridoApiPush
{
    public static async Task Ejecutar(DbContextOptions<AppDbContext> opciones)
    {
        await using var db = new AppDbContext(opciones);
        var principal = new Usuario { Id = Guid.NewGuid(), Estado = EstadoUsuario.Activo, Rol = Rol.CuidadorPrincipal };
        var apoyo = new Usuario { Id = Guid.NewGuid(), Estado = EstadoUsuario.Activo, Rol = Rol.Apoyo };
        db.Usuarios.AddRange(principal, apoyo);
        var perfil = new PerfilDependiente { CreadoPorUsuarioId = principal.Id };
        db.PerfilesDependientes.Add(perfil);
        db.VinculosDependientes.AddRange(new VinculoDependiente(principal.Id, perfil.Id, RolEnDependiente.CuidadorPrincipal), new VinculoDependiente(apoyo.Id, perfil.Id, RolEnDependiente.Apoyo));
        await db.SaveChangesAsync();
        using var entorno = new EntornoPrueba();
        using var servidor = new ServidorApiPrueba(opciones);
        using var cliente = servidor.CreateClient();
        await Comprobar(await cliente.GetAsync("/api/notificaciones/configuracion"), HttpStatusCode.Unauthorized, true);
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", servidor.Token(principal.Id, vencido: true));
        await Comprobar(await cliente.GetAsync("/api/notificaciones/configuracion"), HttpStatusCode.Unauthorized, true);
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", servidor.Token(principal.Id));
        var claves = VapidHelper.GenerateVapidKeys();
        var solicitud = new SolicitudSuscripcionPush { UrlDestino = "https://fcm.googleapis.com/prueba/api-principal", ClavePublica = claves.PublicKey, SecretoAutenticacion = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(16)) };
        var registro = await Comprobar(await cliente.PostAsJsonAsync("/api/notificaciones/suscribir", solicitud), HttpStatusCode.OK);
        var id = registro.GetProperty("id").GetGuid();
        var repetida = await Comprobar(await cliente.PostAsJsonAsync("/api/notificaciones/suscribir", solicitud), HttpStatusCode.OK);
        Exigir(id == repetida.GetProperty("id").GetGuid(), "POST no idempotente");
        var estado = await Comprobar(await cliente.GetAsync("/api/notificaciones/configuracion?idSuscripcion=" + id), HttpStatusCode.OK);
        Exigir(estado.GetProperty("suscripcionActiva").GetBoolean(), "GET no refleja suscripción activa");
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", servidor.Token(apoyo.Id));
        await Comprobar(await cliente.PostAsJsonAsync("/api/notificaciones/suscribir", solicitud), HttpStatusCode.Conflict, true);
        await Comprobar(await cliente.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/notificaciones/desuscribir") { Content = JsonContent.Create(new SolicitudDesuscripcionPush { IdSuscripcion = id }) }), HttpStatusCode.Forbidden, true);
        var estadoAjeno = await Comprobar(await cliente.GetAsync("/api/notificaciones/configuracion?idSuscripcion=" + id), HttpStatusCode.OK);
        Exigir(!estadoAjeno.GetProperty("suscripcionActiva").GetBoolean(), "GET revela estado ajeno");
        solicitud.UrlDestino = "https://127.0.0.1/interno";
        await Comprobar(await cliente.PostAsJsonAsync("/api/notificaciones/suscribir", solicitud), HttpStatusCode.BadRequest, true);
        solicitud.UrlDestino = "https://fcm.googleapis.com/prueba/api-apoyo";
        await Comprobar(await cliente.PostAsJsonAsync("/api/notificaciones/suscribir", solicitud), HttpStatusCode.OK);
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", servidor.Token(principal.Id));
        var inicio = await db.OutboxMensajes.CountAsync();
        foreach (var animo in new[] { "Mal", "MuyMal", "Neutral" })
        {
            var bloque = new BloqueTurno { Id = Guid.NewGuid(), PerfilDependienteId = perfil.Id, CreadoPorId = principal.Id, Fecha = ZonaEcuador.HoyLocal, HoraInicio = new TimeOnly(0, 0), HoraFin = new TimeOnly(23, 59) };
            db.BloquesTurno.Add(bloque);
            await db.SaveChangesAsync();
            var cierre = new SolicitudCierrePrueba(animo, []);
            await Comprobar(await cliente.PostAsJsonAsync($"/api/agenda/{bloque.Id}/completar", cierre), HttpStatusCode.Created);
            await Comprobar(await cliente.PostAsJsonAsync($"/api/agenda/{bloque.Id}/completar", cierre), HttpStatusCode.Conflict, true);
        }
        Exigir(await db.OutboxMensajes.CountAsync() == inicio + 2, "Cierre genera eventos incorrectos");
        var configuracion = Options.Create(servidor.Push);
        await new MaterializadorPush(db, configuracion).Ejecutar(CancellationToken.None);
        var fabrica = new FabricaPrueba(); fabrica.Manejador.Codigo = 201;
        var despachador = new DespachadorPush(db, new TransportePush(fabrica, configuracion), configuracion, NullLogger<DespachadorPush>.Instance);
        var entregas = await despachador.Reclamar(CancellationToken.None);
        Exigir(entregas.Count == 4, "Faltan entregas a principal/apoyo de ambos eventos críticos");
        foreach (var entrega in entregas) await despachador.Enviar(entrega, CancellationToken.None);
        await despachador.Finalizar(CancellationToken.None);
        Exigir(fabrica.Manejador.Llamadas == 4 && await db.EntregasPush.CountAsync(x => x.Estado == EstadoEntregaPush.Aceptada) >= 4, "No completó el envío cifrado");
        var baja = new SolicitudDesuscripcionPush { IdSuscripcion = id };
        for (var i = 0; i < 2; i++) await Comprobar(await cliente.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/notificaciones/desuscribir") { Content = JsonContent.Create(baja) }), HttpStatusCode.OK);
        estado = await Comprobar(await cliente.GetAsync("/api/notificaciones/configuracion?idSuscripcion=" + id), HttpStatusCode.OK);
        Exigir(!estado.GetProperty("suscripcionActiva").GetBoolean(), "La baja no se refleja en API");
        Console.WriteLine("Correcto: recorrido HTTP con JWT RS256 real, suscripción/baja idempotentes, aislamiento de cuentas, estados Mal/MuyMal/Neutral, cierre duplicado y Outbox hasta transporte cifrado simulado.");
    }
    private static void Exigir(bool cumple, string detalle) { if (!cumple) throw new InvalidOperationException(detalle); }
    private static async Task<JsonElement> Comprobar(HttpResponseMessage respuesta, HttpStatusCode esperado, bool problema = false)
    {
        using (respuesta)
        {
            var texto = await respuesta.Content.ReadAsStringAsync();
            Exigir(respuesta.StatusCode == esperado, $"Esperado {esperado}; obtenido {respuesta.StatusCode}: {texto}");
            using var json = JsonDocument.Parse(texto);
            if (problema) Exigir(respuesta.Content.Headers.ContentType?.MediaType == "application/problem+json" && json.RootElement.TryGetProperty("detail", out var detalle) && !string.IsNullOrWhiteSpace(detalle.GetString()), "Error sin RFC 7807 y Detail");
            return json.RootElement.Clone();
        }
    }
    private sealed class EntornoPrueba : IDisposable
    {
        private readonly string? urlAnterior = Environment.GetEnvironmentVariable("SUPABASE_URL");
        private readonly string? claveAnterior = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
        public EntornoPrueba()
        {
            Environment.SetEnvironmentVariable("SUPABASE_URL", "https://supabase.pruebas.invalid");
            Environment.SetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", "valor-ficticio-solo-pruebas");
        }
        public void Dispose()
        {
            Environment.SetEnvironmentVariable("SUPABASE_URL", urlAnterior);
            Environment.SetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", claveAnterior);
        }
    }
    private sealed record SolicitudCierrePrueba(string EstadoAnimo, Guid[] TareasRealizadasIds);
}
