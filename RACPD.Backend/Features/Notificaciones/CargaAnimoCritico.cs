using System.Text.Json.Serialization;
namespace RACPD.Backend.Features.Notificaciones;
public sealed record CargaAnimoCritico(
    [property: JsonPropertyName("bitacoraId")] Guid BitacoraId,
    [property: JsonPropertyName("bloqueId")] Guid BloqueId,
    [property: JsonPropertyName("registradoPorId")] Guid RegistradoPorId,
    [property: JsonPropertyName("estadoAnimo")] string EstadoAnimo,
    [property: JsonPropertyName("fechaCierre")] DateTimeOffset FechaCierre);
public sealed record AvisoPush(string IdMensaje, string Titulo, string Cuerpo, string Ruta);
