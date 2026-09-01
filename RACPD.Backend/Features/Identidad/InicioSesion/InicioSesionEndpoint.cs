using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RACPD.Backend.Features.Identidad.InicioSesion;

public class IniciarSesionRequest
{
    public string Correo { get; set; } = string.Empty;
    public string Contrasena { get; set; } = string.Empty;
}

public class IniciarSesionValidator : Validator<IniciarSesionRequest>
{
    public IniciarSesionValidator()
    {
        RuleFor(x => x.Correo)
            .NotEmpty().WithMessage("El correo es requerido.")
            .EmailAddress().WithMessage("El correo no tiene un formato válido.");
            
        RuleFor(x => x.Contrasena)
            .NotEmpty().WithMessage("La contraseña es requerida.");
    }
}

public class UsuarioDto
{
    public Guid Id { get; set; }
    public string Correo { get; set; } = string.Empty;
    public string Rol { get; set; } = string.Empty;
}

public class IniciarSesionResponse
{
    public string Token { get; set; } = string.Empty;
    public UsuarioDto Usuario { get; set; } = default!;
}

// Supabase responses
public class SupabaseAuthResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;
    
    [JsonPropertyName("user")]
    public SupabaseUser User { get; set; } = default!;
}

public class SupabaseUser
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }
}

public class InicioSesionEndpoint : Endpoint<IniciarSesionRequest, IniciarSesionResponse>
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public InicioSesionEndpoint(AppDbContext dbContext, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    public override void Configure()
    {
        Post("/api/inicio-sesion");
        AllowAnonymous();
    }

    public override async Task HandleAsync(IniciarSesionRequest req, CancellationToken ct)
    {
        var supabaseUrl = _configuration["SUPABASE_URL"];
        var supabaseAnonKey = _configuration["SUPABASE_SERVICE_ROLE_KEY"]; 

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseAnonKey))
        {
            AddError("Configuración de Supabase faltante en el servidor.");
            ThrowIfAnyErrors();
        }

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("apikey", supabaseAnonKey);

        var authRequest = new
        {
            email = req.Correo,
            password = req.Contrasena
        };

        var content = new StringContent(JsonSerializer.Serialize(authRequest), global::System.Text.Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{supabaseUrl}/auth/v1/token?grant_type=password", content, ct);

        if (!response.IsSuccessStatusCode)
        {
            AddError("Credenciales inválidas.");
            ThrowIfAnyErrors();
        }

        var responseString = await response.Content.ReadAsStringAsync(ct);
        var authResult = JsonSerializer.Deserialize<SupabaseAuthResponse>(responseString);

        if (authResult == null || string.IsNullOrEmpty(authResult.AccessToken) || authResult.User == null)
        {
            AddError("Error al procesar la respuesta de autenticación.");
            ThrowIfAnyErrors();
        }

        var usuarioId = authResult!.User!.Id;
        
        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId, ct);

        if (usuario == null)
        {
            AddError("El usuario no está registrado en el sistema local.");
            ThrowIfAnyErrors();
        }

        var responseDto = new IniciarSesionResponse
        {
            Token = authResult!.AccessToken,
            Usuario = new UsuarioDto
            {
                Id = usuario!.Id,
                Correo = usuario.Correo,
                Rol = usuario.Rol.ToString()
            }
        };

        HttpContext.Response.StatusCode = 200;
        await HttpContext.Response.WriteAsJsonAsync(responseDto, ct);
    }
}
