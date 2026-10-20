using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
namespace RACPD.Backend.Features.Notificaciones;
public static class ErroresPush
{
    public static bool Identificar(ClaimsPrincipal usuario, out Guid id) => Guid.TryParse(usuario.FindFirstValue("sub"), out id);
    public static Task Enviar(HttpContext contexto, int codigo, string detalle) => Results.Problem(
        statusCode: codigo, title: "No se pudo completar la operación de notificaciones",
        detail: detalle, type: "https://racpd.app/errors/notificaciones", instance: contexto.Request.Path).ExecuteAsync(contexto);
}
public sealed record RespuestaSuscripcionPush(Guid Id, bool Activa);
