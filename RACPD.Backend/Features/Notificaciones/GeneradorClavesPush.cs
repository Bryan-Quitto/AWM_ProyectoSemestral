using System.Text.Json;
using WebPush;
namespace RACPD.Backend.Features.Notificaciones;
public static class GeneradorClavesPush
{
    public static async Task Ejecutar()
    {
        const string ruta = "appsettings.Push.local.json";
        var claves = VapidHelper.GenerateVapidKeys();
        await using var archivo = new FileStream(ruta, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await JsonSerializer.SerializeAsync(archivo, new ConfiguracionLocalPush(new OpcionesPush
        { ClavePublica = claves.PublicKey, ClavePrivada = claves.PrivateKey }), new JsonSerializerOptions { WriteIndented = true });
        Console.WriteLine("Claves creadas en appsettings.Push.local.json (ignorado por Git). Completa Asunto con tu contacto mailto: antes de habilitar el servicio.");
    }
    private sealed record ConfiguracionLocalPush(OpcionesPush NotificacionesPush);
}
