using Microsoft.AspNetCore.Mvc;

namespace RACPD.Backend.Infrastructure;

/// <summary>
/// Helper estático para emitir respuestas de error en formato RFC 7807 (ProblemDetails)
/// desde los endpoints de FastEndpoints. Centraliza la serialización y los
/// content types correctos. Trabaja directamente sobre HttpContext para evitar
/// dependencias de tipo sobre las clases base de FastEndpoints.
/// </summary>
public static class ProblemDetailsHelper
{
    private const string ContentType = "application/problem+json";
    private const string BaseTypeUri = "https://racpd.app/errors/";

    /// <summary>
    /// Envía una respuesta 404 (Recurso no encontrado) directamente al HttpContext.
    /// </summary>
    public static async Task EnviarNoEncontradoAsync(
        HttpContext httpContext,
        string detalle,
        string tipoRecurso = "recurso-no-encontrado")
    {
        var problema = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = BaseTypeUri + tipoRecurso,
            Title = "Recurso no encontrado",
            Status = StatusCodes.Status404NotFound,
            Detail = detalle,
            Instance = httpContext.Request.Path
        };
        await EscribirAsync(httpContext, StatusCodes.Status404NotFound, problema);
    }

    /// <summary>
    /// Envía una respuesta 400 con la lista de errores como ValidationProblemDetails.
    /// </summary>
    public static async Task EnviarErroresValidacionAsync(
        HttpContext httpContext,
        IDictionary<string, IEnumerable<string>> errores,
        string detalle,
        string titulo = "La solicitud contiene errores de validación")
    {
        var problema = new Microsoft.AspNetCore.Mvc.ValidationProblemDetails(
            errores.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray()))
        {
            Type = BaseTypeUri + "validacion",
            Title = titulo,
            Status = StatusCodes.Status400BadRequest,
            Detail = detalle,
            Instance = httpContext.Request.Path
        };
        await EscribirAsync(httpContext, StatusCodes.Status400BadRequest, problema);
    }

    /// <summary>
    /// Envía una respuesta 409 (Conflicto de negocio: regla violada).
    /// </summary>
    public static async Task EnviarConflictoAsync(
        HttpContext httpContext,
        string detalle,
        string tipoConflicto = "conflicto")
    {
        var problema = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = BaseTypeUri + tipoConflicto,
            Title = "Conflicto",
            Status = StatusCodes.Status409Conflict,
            Detail = detalle,
            Instance = httpContext.Request.Path
        };
        await EscribirAsync(httpContext, StatusCodes.Status409Conflict, problema);
    }

    /// <summary>
    /// Envía una respuesta 403 (Prohibido: la regla de autorización interna falló).
    /// </summary>
    public static async Task EnviarProhibidoAsync(
        HttpContext httpContext,
        string detalle,
        string tipoProhibido = "prohibido")
    {
        var problema = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = BaseTypeUri + tipoProhibido,
            Title = "Acceso prohibido",
            Status = StatusCodes.Status403Forbidden,
            Detail = detalle,
            Instance = httpContext.Request.Path
        };
        await EscribirAsync(httpContext, StatusCodes.Status403Forbidden, problema);
    }

    /// <summary>
    /// Envía una respuesta 401 cuando no se puede identificar al usuario autenticado.
    /// </summary>
    public static async Task EnviarNoAutenticadoAsync(
        HttpContext httpContext,
        string detalle = "No se pudo identificar al usuario autenticado.")
    {
        var problema = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Type = BaseTypeUri + "no-autenticado",
            Title = "Usuario no autenticado",
            Status = StatusCodes.Status401Unauthorized,
            Detail = detalle,
            Instance = httpContext.Request.Path
        };
        await EscribirAsync(httpContext, StatusCodes.Status401Unauthorized, problema);
    }

    private static async Task EscribirAsync(HttpContext httpContext, int statusCode, object problema)
    {
        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = ContentType;
        var json = global::System.Text.Json.JsonSerializer.Serialize(problema);
        await httpContext.Response.WriteAsync(json);
    }
}