using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RACPD.Backend.Data;

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Determinar el string de conexión (Priorizar Migración directa si existe)
var connectionString = builder.Configuration["MIGRATION_DB_CONNECTION_STRING"]?.Trim('"')
                       ?? builder.Configuration["SUPABASE_DB_CONNECTION_STRING"]?.Trim('"');

// Orígenes permitidos para CORS. El frontend de RACPD corre en
// http://localhost:3000 (Vite dev) y en producción detrás del mismo dominio.
var origenesPermitidosCORS = new[]
{
    "http://localhost:3000",
    "http://127.0.0.1:3000"
};

builder.Services.AddCors(opciones =>
{
    // Política con nombre explícito para evitar el bug de "Multiple constructors"
    // en .NET 10 cuando se usa AddDefaultPolicy con UseCors().
    opciones.AddPolicy("RACPD", politica =>
    {
        politica.WithOrigins(origenesPermitidosCORS)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Configurar Entity Framework Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Configurar Autenticación JWKS con Supabase (Cero Indulgencia - RS256).
// El Custom Access Token Hook de Supabase inyecta el claim raíz `role`
// en cada JWT, así que basta con decirle a .NET que ese es el RoleClaimType.
var urlSupabase = builder.Configuration["SUPABASE_URL"]?.Trim('"');
var claveServicioSupabase = builder.Configuration["SUPABASE_SERVICE_ROLE_KEY"]?.Trim('"');

// Fail-fast si faltan variables críticas. Antes, los valores faltantes
// provocaban que el AdminClient cayera en defaults (localhost:9999) y
// reventara con 500 text/plain en POST /api/usuarios/invitar.
if (string.IsNullOrWhiteSpace(urlSupabase))
{
    throw new InvalidOperationException(
        "Falta la variable de entorno SUPABASE_URL. " +
        "Define la URL del proyecto Supabase (ej. https://xxx.supabase.co) " +
        "en el archivo .env antes de iniciar el backend.");
}
if (string.IsNullOrWhiteSpace(claveServicioSupabase))
{
    throw new InvalidOperationException(
        "Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. " +
        "Esta llave SOLO debe estar en el backend; nunca en el frontend. " +
        "Encuéntrala en Supabase → Settings → API.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"{urlSupabase}/auth/v1";
        // Desactivar el mapeo automático de claims directamente en el handler.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidAudience = "authenticated",
            ValidIssuer = $"{urlSupabase}/auth/v1",
            // Claim raíz del JWT que .NET debe usar para User.IsInRole().
            RoleClaimType = "role",
            // Identidad del usuario: usar el email (que viene como claim
            // raíz en el JWT de Supabase) en lugar del `sub`.
            NameClaimType = "email"
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument();
builder.Services.AddHttpClient();

// Configurar Supabase Client.
// urlSupabase y claveServicioSupabase ya fueron validados arriba como
// no vacíos (fail-fast). Aquí reutilizamos las mismas constantes para
// construir el cliente completo y el AdminClient del GoTrue.
{
    var options = new Supabase.SupabaseOptions { AutoRefreshToken = true, AutoConnectRealtime = true };
    builder.Services.AddSingleton(provider => new Supabase.Client(urlSupabase!, claveServicioSupabase!, options));

    // Configurar Supabase GoTrue AdminClient (Para invitaciones con Service Role)
    var authUrl = $"{urlSupabase}/auth/v1";
    var gotrueOptions = new Supabase.Gotrue.ClientOptions { AllowUnconfirmedUserSessions = true };
    gotrueOptions.Headers.Add("Authorization", $"Bearer {claveServicioSupabase}");
    gotrueOptions.Headers.Add("apikey", claveServicioSupabase);
    builder.Services.AddSingleton(provider => new Supabase.Gotrue.AdminClient(authUrl, gotrueOptions));
}

var app = builder.Build();

// CORS debe ir antes de UseAuthentication/UseAuthorization para que las
// respuestas a preflight OPTIONS (que NO llevan credenciales) se gestionen
// correctamente.
app.UseCors("RACPD");

app.UseAuthentication();

// Middleware de diagnóstico: imprime los claims efectivos que ve FastEndpoints
// tras la autenticación. Útil para depurar problemas de RoleClaimType.
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var claims = context.User.Claims.Select(c => $"{c.Type}: {c.Value}");
        Console.WriteLine("--- CLAIMS REALES EN ESTA PETICIÓN ---");
        Console.WriteLine(string.Join("\n", claims));
        Console.WriteLine("--------------------------------------");
    }
    await next();
});

app.UseAuthorization();

app.UseFastEndpoints();
app.UseSwaggerGen();

app.Run();
