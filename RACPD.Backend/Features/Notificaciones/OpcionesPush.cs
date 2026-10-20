using System.Security.Cryptography;
using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.WebUtilities;
namespace RACPD.Backend.Features.Notificaciones;
public sealed class OpcionesPush
{
    public string ClavePublica { get; set; } = string.Empty;
    public string ClavePrivada { get; set; } = string.Empty;
    public string Asunto { get; set; } = string.Empty;
    public string[] OrigenesPermitidos { get; set; } = ["https://fcm.googleapis.com", "https://updates.push.services.mozilla.com", "https://web.push.apple.com"];
    public int IntervaloSegundos { get; set; } = 5;
    public int Lote { get; set; } = 50;
    public int Concurrencia { get; set; } = 4;
    public int MaximoIntentos { get; set; } = 8;
    public int TtlSegundos { get; set; } = 3600;
    public bool Disponible => ClaveValida(ClavePublica, 65) && ClaveValida(ClavePrivada, 32)
        && Uri.TryCreate(Asunto, UriKind.Absolute, out var uri) && (uri.Scheme == "mailto" || uri.Scheme == "https");
    public bool DestinoPermitido(string? destino) => !string.IsNullOrWhiteSpace(destino) && destino.Length <= 2048
        && Uri.TryCreate(destino, UriKind.Absolute, out var uri) && uri.Scheme == "https"
        && uri.IsDefaultPort && string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Fragment)
        && !IPAddress.TryParse(uri.Host, out _) && OrigenesPermitidos.Contains(uri.GetLeftPart(UriPartial.Authority), StringComparer.OrdinalIgnoreCase);
    public static bool ClaveValida(string? valor, int longitud)
    {
        if (string.IsNullOrWhiteSpace(valor) || valor.Length > 128) return false;
        try
        {
            var bytes = WebEncoders.Base64UrlDecode(valor);
            if (bytes.Length != longitud) return false;
            if (longitud != 65) return true;
            if (bytes[0] != 4) return false;
            using var curva = ECDiffieHellman.Create(new ECParameters
            { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = bytes[1..33], Y = bytes[33..65] } });
            return true;
        }
        catch (CryptographicException) { return false; }
        catch (FormatException) { return false; }
    }
    public static bool DireccionPublica(IPAddress direccion)
    {
        if (direccion.IsIPv4MappedToIPv6) direccion = direccion.MapToIPv4();
        if (IPAddress.IsLoopback(direccion)) return false;
        var b = direccion.GetAddressBytes();
        if (direccion.AddressFamily == AddressFamily.InterNetworkV6)
            return (b[0] & 0xe0) == 0x20; // Solo unicast global 2000::/3.
        return b[0] is not (0 or 10 or 127) && b[0] < 224
            && !(b[0] == 169 && b[1] == 254) && !(b[0] == 172 && b[1] >= 16 && b[1] <= 31)
            && !(b[0] == 192 && b[1] == 168) && !(b[0] == 100 && b[1] >= 64 && b[1] <= 127);
    }
}
