using System.Text.Json;
using System.Text.Json.Serialization;
using FastEndpoints;
using System.Net.Http.Headers;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Usuarios.Invitar;

public record InvitarUsuarioRequest(string Correo, Rol Rol);
public record InvitarUsuarioResponse(string Mensaje, string Correo);

public class InvitarUsuarioValidator : Validator<InvitarUsuarioRequest>
{
    public InvitarUsuarioValidator()
    {
        RuleFor(x => x.Correo)
            .NotEmpty().WithMessage("El correo es requerido.")
            .EmailAddress().WithMessage("El correo no tiene un formato válido.");
    }
}

/// <summary>
/// Respuesta de POST /auth/v1/invite.
/// Devuelve directamente el objeto User.
/// </summary>
internal class SupabaseInviteUser
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
}

/// <summary>
/// Endpoint de invitación por correo (rol AdministradorSistema únicamente).
///
/// DECISIÓN ARQUITECTÓNICA IMPORTANTE:
/// Antes este endpoint dependía de `Supabase.Gotrue.AdminClient.InviteUserByEmail(...)`.
/// El SDK apuntaba a `localhost:9999` aunque le pasaras una URL válida.
/// Luego pasamos a `POST /admin/generate_link`, pero este endpoint NO envía el correo,
/// solo genera el link (fue diseñado para cuando tú quieres enviar el correo por tu cuenta).
/// El endpoint correcto del API de GoTrue para invitar y que Supabase dispare el correo
/// a través de SMTP configurado (Brevo) es `POST /auth/v1/invite`.
/// </summary>
public class InvitarEndpoint : Endpoint<InvitarUsuarioRequest, InvitarUsuarioResponse>
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<InvitarEndpoint> _logger;

    public InvitarEndpoint(
        AppDbContext dbContext,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<InvitarEndpoint> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public override void Configure()
    {
        Post("/api/usuarios/invitar");
        Roles(Rol.AdministradorSistema.ToString());
    }

    public override async Task HandleAsync(InvitarUsuarioRequest req, CancellationToken ct)
    {
        _logger.LogInformation(
            "[Invitar] correo recibido='{Correo}' longitud={Len}",
            req.Correo,
            req.Correo?.Length ?? -1);

        var urlSupabase = _configuration["SUPABASE_URL"]?.Trim('"');
        var claveServicioSupabase = _configuration["SUPABASE_SERVICE_ROLE_KEY"]?.Trim('"');
        if (string.IsNullOrWhiteSpace(urlSupabase) || string.IsNullOrWhiteSpace(claveServicioSupabase))
        {
            _logger.LogError("[Invitar] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en la configuración.");
            AddError("El backend no está configurado correctamente. Contacta al administrador.");
            await Send.ErrorsAsync(StatusCodes.Status500InternalServerError, ct);
            return;
        }

        var correoNormalizado = req.Correo!.Trim().ToLowerInvariant();
        var usuarioLocal = await _dbContext.Usuarios
            .FirstOrDefaultAsync(u => u.Correo.ToLower() == correoNormalizado, ct);

        var clienteHttp = _httpClientFactory.CreateClient();
        clienteHttp.DefaultRequestHeaders.Clear();
        clienteHttp.DefaultRequestHeaders.Add("apikey", claveServicioSupabase);
        clienteHttp.DefaultRequestHeaders.Add("Authorization", $"Bearer {claveServicioSupabase}");

        if (usuarioLocal != null)
        {
            if (usuarioLocal.Estado != EstadoUsuario.PendienteAceptacion)
            {
                await Send.ResponseAsync(
                    new InvitarUsuarioResponse(
                        "Este correo ya fue invitado y aceptó la invitación. Pídele al usuario que use 'Olvidé mi contraseña' o revise su bandeja de entrada.",
                        req.Correo),
                    409,
                    ct);
                return;
            }

            // Está PendienteAceptacion: Borramos de Supabase para poder re-invitar
            try
            {
                var responseDelete = await clienteHttp.DeleteAsync($"{urlSupabase}/auth/v1/admin/users/{usuarioLocal.Id}", ct);
                if (!responseDelete.IsSuccessStatusCode && responseDelete.StatusCode != global::System.Net.HttpStatusCode.NotFound)
                {
                    _logger.LogWarning("[Invitar] Fallo al borrar usuario de Supabase antes de re-invitar. Status={Status}", responseDelete.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Invitar] Error al borrar usuario de Supabase antes de re-invitar.");
            }

            // Borramos el registro local para poder insertar el nuevo con el nuevo ID de Supabase
            _dbContext.Usuarios.Remove(usuarioLocal);
            await _dbContext.SaveChangesAsync(ct);
        }

        var cuerpoInvitacion = new
        {
            email = req.Correo,
            data = new
            {
                role = req.Rol.ToString()
            }
        };

        var contenido = new StringContent(
            JsonSerializer.Serialize(cuerpoInvitacion),
            global::System.Text.Encoding.UTF8,
            "application/json");
        contenido.Headers.ContentType = MediaTypeHeaderValue.Parse("application/json");

        HttpResponseMessage respuestaSupabase;
        try
        {
            // Usamos redirect_to en la URL para que GoTrue lo incluya en el email
            var inviteUrl = $"{urlSupabase}/auth/v1/invite?redirect_to=http://localhost:3000/inicio-sesion";
            respuestaSupabase = await clienteHttp.PostAsync(inviteUrl, contenido, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[Invitar] Fallo de red al llamar a Supabase /invite. " +
                "Tipo={Tipo} Mensaje={Mensaje} Inner={Inner}",
                ex.GetType().FullName,
                ex.Message,
                ex.InnerException?.Message);

            AddError($"No se pudo contactar el servicio de autenticación para enviar la invitación: {ex.Message}");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        var cuerpoRespuesta = await respuestaSupabase.Content.ReadAsStringAsync(ct);

        if (!respuestaSupabase.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "[Invitar] Supabase devolvió {StatusCode}. Cuerpo={Cuerpo}",
                (int)respuestaSupabase.StatusCode,
                cuerpoRespuesta);

            if (respuestaSupabase.StatusCode == global::System.Net.HttpStatusCode.UnprocessableEntity)
            {
                await Send.ResponseAsync(
                    new InvitarUsuarioResponse(
                        "No se pudo invitar al usuario. Es posible que el correo ya esté registrado en la plataforma.",
                        req.Correo),
                    409,
                    ct);
                return;
            }

            AddError($"El servicio de autenticación rechazó la invitación (HTTP {(int)respuestaSupabase.StatusCode}).");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        SupabaseInviteUser? usuarioInvitado;
        try
        {
            // POST /auth/v1/invite devuelve el objeto User directamente, no envuelto en { user: ... }
            usuarioInvitado = JsonSerializer.Deserialize<SupabaseInviteUser>(
                cuerpoRespuesta,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex,
                "[Invitar] No se pudo parsear la respuesta de Supabase. Cuerpo={Cuerpo}",
                cuerpoRespuesta);
            AddError("La respuesta del servicio de autenticación tuvo un formato inesperado.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        if (usuarioInvitado == null || usuarioInvitado.Id == Guid.Empty)
        {
            AddError("No se encontró el ID del usuario en la respuesta de Supabase tras la invitación.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        try
        {
            var clienteRol = _httpClientFactory.CreateClient();
            clienteRol.DefaultRequestHeaders.Clear();
            clienteRol.DefaultRequestHeaders.Add("apikey", claveServicioSupabase);
            clienteRol.DefaultRequestHeaders.Add("Authorization", $"Bearer {claveServicioSupabase}");

            var atributos = new { app_metadata = new { role = req.Rol.ToString() } };
            var contenidoRol = new StringContent(
                JsonSerializer.Serialize(atributos),
                global::System.Text.Encoding.UTF8,
                "application/json");
            contenidoRol.Headers.ContentType = MediaTypeHeaderValue.Parse("application/json");

            var respuestaRol = await clienteRol.PutAsync(
                $"{urlSupabase}/auth/v1/admin/users/{usuarioInvitado.Id}",
                contenidoRol,
                ct);

            if (!respuestaRol.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "[Invitar] PUT /admin/users/{{Id}} devolvió {StatusCode}. El rol en app_metadata no se pudo asignar.",
                    (int)respuestaRol.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "[Invitar] Excepción al asignar app_metadata.role. La fila local igual se creará.");
        }

        var nuevoUsuario = new Usuario
        {
            Id = usuarioInvitado.Id,
            Correo = req.Correo,
            Nombre = string.Empty,
            Apellido = string.Empty,
            Rol = req.Rol,
            Estado = EstadoUsuario.PendienteAceptacion,
            FechaCreacion = DateTimeOffset.UtcNow,
            FechaCompletadoPerfil = null
        };

        _dbContext.Usuarios.Add(nuevoUsuario);
        try
        {
            await _dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex,
                "[Invitar] Error al persistir fila local. Inner={Inner} Correo={Correo} IdSupabase={Id}",
                ex.InnerException?.Message,
                req.Correo,
                usuarioInvitado.Id);

            AddError("El usuario fue invitado correctamente, pero no se pudo guardar la fila local. Intenta nuevamente en un minuto.");
            await Send.ErrorsAsync(StatusCodes.Status502BadGateway, ct);
            return;
        }

        await Send.OkAsync(
            new InvitarUsuarioResponse("Invitación enviada con éxito.", req.Correo),
            ct);
    }
}

