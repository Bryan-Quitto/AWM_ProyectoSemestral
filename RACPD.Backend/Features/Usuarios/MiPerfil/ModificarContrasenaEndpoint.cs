using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Enums;

namespace RACPD.Backend.Features.Usuarios.MiPerfil;

public record ModificarContrasenaRequest(string ContrasenaActual, string NuevaContrasena);

public class ModificarContrasenaValidator : Validator<ModificarContrasenaRequest>
{
    public ModificarContrasenaValidator()
    {
        RuleFor(x => x.ContrasenaActual)
            .NotEmpty().WithMessage("La contraseña actual es requerida.");

        RuleFor(x => x.NuevaContrasena)
            .NotEmpty().WithMessage("La nueva contraseña es requerida.")
            .MinimumLength(8).WithMessage("La nueva contraseña debe tener al menos 8 caracteres.");
    }
}

public class ModificarContrasenaEndpoint : Endpoint<ModificarContrasenaRequest, EmptyResponse>
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public ModificarContrasenaEndpoint(AppDbContext dbContext, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    public override void Configure()
    {
        Put("/api/usuarios/mi-perfil/contrasena");
        Roles(
            Rol.AdministradorSistema.ToString(),
            Rol.CuidadorPrincipal.ToString(),
            Rol.Apoyo.ToString());
    }

    public override async Task HandleAsync(ModificarContrasenaRequest req, CancellationToken ct)
    {
        var usuarioIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(usuarioIdString) || !Guid.TryParse(usuarioIdString, out var usuarioId))
        {
            AddError("No se pudo identificar al usuario autenticado.");
            ThrowIfAnyErrors();
            return;
        }

        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId, ct);

        if (usuario == null)
        {
            AddError("El usuario autenticado no está registrado en el sistema local.");
            ThrowIfAnyErrors();
            return;
        }

        var supabaseUrl = _configuration["SUPABASE_URL"];
        var supabaseAnonKey = _configuration["SUPABASE_SERVICE_ROLE_KEY"]; 

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseAnonKey))
        {
            AddError("Configuración de Supabase faltante en el servidor.");
            ThrowIfAnyErrors();
            return;
        }

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("apikey", supabaseAnonKey);

        // 1. Verificar la contraseña actual obteniendo un nuevo token
        var authRequest = new
        {
            email = usuario.Correo,
            password = req.ContrasenaActual
        };

        var content = new StringContent(JsonSerializer.Serialize(authRequest), global::System.Text.Encoding.UTF8, "application/json");
        var authResponse = await client.PostAsync($"{supabaseUrl}/auth/v1/token?grant_type=password", content, ct);

        if (!authResponse.IsSuccessStatusCode)
        {
            AddError(r => r.ContrasenaActual, "La contraseña actual es incorrecta.");
            ThrowIfAnyErrors();
            return;
        }

        var authResponseString = await authResponse.Content.ReadAsStringAsync(ct);
        using var jsonDocument = JsonDocument.Parse(authResponseString);
        if (!jsonDocument.RootElement.TryGetProperty("access_token", out var accessTokenElement))
        {
            AddError("Error al verificar la contraseña actual.");
            ThrowIfAnyErrors();
            return;
        }

        var accessToken = accessTokenElement.GetString();

        // 2. Actualizar la contraseña usando el token obtenido
        var updateRequest = new
        {
            password = req.NuevaContrasena
        };

        var updateContent = new StringContent(JsonSerializer.Serialize(updateRequest), global::System.Text.Encoding.UTF8, "application/json");
        
        var updateClient = _httpClientFactory.CreateClient();
        updateClient.DefaultRequestHeaders.Add("apikey", supabaseAnonKey);
        updateClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

        var updateResponse = await updateClient.PutAsync($"{supabaseUrl}/auth/v1/user", updateContent, ct);

        if (!updateResponse.IsSuccessStatusCode)
        {
            Logger.LogError("Error al actualizar la contraseña en Supabase: {StatusCode} - {Body}", updateResponse.StatusCode, await updateResponse.Content.ReadAsStringAsync(ct));
            AddError("Ocurrió un error al intentar cambiar la contraseña.");
            ThrowIfAnyErrors();
            return;
        }

        await Send.OkAsync(ct);
    }
}
