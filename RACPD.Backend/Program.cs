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

// Configurar Entity Framework Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Configurar Autenticación JWKS con Supabase (Cero Indulgencia - RS256)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://cpksjxocccqejjbvsxle.supabase.co/auth/v1";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidAudience = "authenticated",
            ValidIssuer = "https://cpksjxocccqejjbvsxle.supabase.co/auth/v1"
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument();
builder.Services.AddHttpClient();

// Configurar Supabase Client
var supabaseUrl = builder.Configuration["SUPABASE_URL"];
var supabaseKey = builder.Configuration["SUPABASE_SERVICE_ROLE_KEY"];
if (!string.IsNullOrEmpty(supabaseUrl) && !string.IsNullOrEmpty(supabaseKey))
{
    var options = new Supabase.SupabaseOptions { AutoRefreshToken = true, AutoConnectRealtime = true };
    builder.Services.AddSingleton(provider => new Supabase.Client(supabaseUrl, supabaseKey, options));

    // Configurar Supabase GoTrue AdminClient (Para invitaciones con Service Role)
    var authUrl = $"{supabaseUrl}/auth/v1";
    var gotrueOptions = new Supabase.Gotrue.ClientOptions { AllowUnconfirmedUserSessions = true };
    gotrueOptions.Headers.Add("Authorization", $"Bearer {supabaseKey}");
    gotrueOptions.Headers.Add("apikey", supabaseKey);
    builder.Services.AddSingleton(provider => new Supabase.Gotrue.AdminClient(authUrl, gotrueOptions));
}

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.UseFastEndpoints();
app.UseSwaggerGen();

app.Run();
