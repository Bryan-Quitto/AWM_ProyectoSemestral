using FastEndpoints;
using Microsoft.Extensions.FileProviders;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;

namespace RACPD.Backend.Features.Evidencias.Subir;

/// <summary>
/// Endpoint POST /api/evidencias/subir — Semana 3 / Persona 1.
///
/// Recibe una imagen médica/clínica multipart/form-data, valida su tamaño (máx 20MB),
/// valida Magic Bytes (JPEG, PNG, WEBP), almacena el archivo localmente en
/// RACPD.Backend/uploads/evidencias/{guid}.ext y retorna la URL pública relativa.
///
/// Errores: Cumplimiento estricto de RFC 7807 (ProblemDetails).
/// </summary>
public class SubirEvidenciaEndpoint : Endpoint<SubirEvidenciaRequest, SubirEvidenciaResponse>
{
    private readonly IWebHostEnvironment _env;
    private const long TamanoMaximoBytes = 20 * 1024 * 1024; // 20 MB

    // Magic Bytes permitidos
    private static readonly Dictionary<string, byte[][]> FirmasPermitidas = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = [ [0xFF, 0xD8, 0xFF] ],
        [".jpeg"] = [ [0xFF, 0xD8, 0xFF] ],
        [".png"] = [ [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] ],
        [".webp"] = [ [0x52, 0x49, 0x46, 0x46] ] // RIFF....WEBP
    };

    public SubirEvidenciaEndpoint(IWebHostEnvironment env)
    {
        _env = env;
    }

    public override void Configure()
    {
        Post("/api/evidencias/subir");
        AllowFileUploads();
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(SubirEvidenciaRequest req, CancellationToken ct)
    {
        var archivo = req.Archivo ?? (Files.Count > 0 ? Files[0] : null);

        if (archivo is null || archivo.Length == 0)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["archivo"] = ["Debe adjuntar un archivo de imagen válido."]
                },
                "No se proporcionó ningún archivo de evidencia.");
            return;
        }

        if (archivo.Length > TamanoMaximoBytes)
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["archivo"] = ["El tamaño del archivo excede el límite máximo permitido de 20 MB."]
                },
                "El archivo supera el tamaño máximo permitido.");
            return;
        }

        var extension = Path.GetExtension(archivo.FileName)?.ToLowerInvariant();
        if (string.IsNullOrEmpty(extension) || !FirmasPermitidas.ContainsKey(extension))
        {
            await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                HttpContext,
                new Dictionary<string, IEnumerable<string>>
                {
                    ["archivo"] = ["Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP."]
                },
                "Tipo de archivo no permitido.");
            return;
        }

        // Validación estricta de Magic Bytes en el stream de bytes
        await using (var stream = archivo.OpenReadStream())
        {
            var headerBytes = new byte[12];
            var bytesLeidos = await stream.ReadAsync(headerBytes.AsMemory(0, headerBytes.Length), ct);

            if (bytesLeidos < 4)
            {
                await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                    HttpContext,
                    new Dictionary<string, IEnumerable<string>>
                    {
                        ["archivo"] = ["El archivo está corrupto o es inválido."]
                    },
                    "Archivo inválido.");
                return;
            }

            var firmasValidas = FirmasPermitidas[extension];
            var firmaCoincide = firmasValidas.Any(firma =>
                headerBytes.Take(firma.Length).SequenceEqual(firma));

            // Si es WebP, validar también que contenga 'WEBP' en bytes 8..11
            if (extension == ".webp" && firmaCoincide)
            {
                var esWebpValido = bytesLeidos >= 12 &&
                                   headerBytes[8] == 0x57 && // 'W'
                                   headerBytes[9] == 0x45 && // 'E'
                                   headerBytes[10] == 0x42 && // 'B'
                                   headerBytes[11] == 0x50;   // 'P'
                if (!esWebpValido)
                {
                    firmaCoincide = false;
                }
            }

            if (!firmaCoincide)
            {
                await ProblemDetailsHelper.EnviarErroresValidacionAsync(
                    HttpContext,
                    new Dictionary<string, IEnumerable<string>>
                    {
                        ["archivo"] = ["La firma binaria del archivo no coincide con una imagen válida permitida."]
                    },
                    "Firma binaria de imagen inválida.");
                return;
            }
        }

        // Directorio físico uploads/evidencias
        var carpetaUploads = Path.Combine(_env.ContentRootPath, "uploads", "evidencias");
        if (!Directory.Exists(carpetaUploads))
        {
            Directory.CreateDirectory(carpetaUploads);
        }

        var nombreUnico = $"{Guid.NewGuid():N}{extension}";
        var rutaFisicaCompleta = Path.Combine(carpetaUploads, nombreUnico);

        await using (var fileStream = new FileStream(rutaFisicaCompleta, FileMode.Create, FileAccess.Write))
        {
            await archivo.CopyToAsync(fileStream, ct);
        }

        var urlRelativa = $"/uploads/evidencias/{nombreUnico}";

        await Send.OkAsync(new SubirEvidenciaResponse(urlRelativa), ct);
    }
}

public class SubirEvidenciaRequest
{
    public IFormFile? Archivo { get; set; }
}

public record SubirEvidenciaResponse(string Url);
