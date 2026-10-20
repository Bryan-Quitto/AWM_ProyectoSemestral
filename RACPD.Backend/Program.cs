using RACPD.Backend.Features.Notificaciones;
using System.Text.Json.Serialization;
using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RACPD.Backend.Data;

if (args.Contains("--generar-claves-push"))
{
    await GeneradorClavesPush.Ejecutar();
    return;
}
DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Push.local.json", optional: true).AddEnvironmentVariables();

// Determinar el string de conexión (Priorizar Migración directa si existe)
var connectionString = builder.Configuration["MIGRATION_DB_CONNECTION_STRING"]?.Trim('"')
                       ?? builder.Configuration["SUPABASE_DB_CONNECTION_STRING"]?.Trim('"');

// Orígenes permitidos para CORS. El frontend de RACPD corre en
// http://localhost:3000 o http://localhost:5174 (Vite dev) según el
// puerto configurado en vite.config.ts. En producción se sirve detrás
// del mismo dominio.
var origenesPermitidosCORS = new[]
{
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174"
};

builder.Services.AddCors(opciones =>
{
    // Política con nombre explícito para evitar el bug de "Multiple constructors"
    // en .NET 10 cuando se usa AddDefaultPolicy con UseCors().
    opciones.AddPolicy("RACPD", politica =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // En desarrollo se permite cualquier origen (túneles Cloudflare, IPs locales, localhost)
            politica.SetIsOriginAllowed(_ => true)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
        else
        {
            politica.WithOrigins(origenesPermitidosCORS)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
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
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
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

// Soporte para RFC 7807 ProblemDetails en respuestas de error.
builder.Services.AddProblemDetails();

// === Serialización JSON: enums como STRING (tanto entrada como salida) ===
// El frontend envía "estadoAnimo":"MuyMal" (nombre de enum), no 0..4.
// Sin este converter, System.Text.Json lanza:
//   "The JSON value could not be converted to EstadoAnimoTurno"
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});

builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument();
DocumentOptions.SwaggerExportPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "RACPD.Frontend"));
builder.Services.AddHttpClient();
builder.Services.Configure<OpcionesPush>(builder.Configuration.GetSection("NotificacionesPush"));
builder.Services.AddHttpClient("push", c => c.Timeout = TimeSpan.FromSeconds(10))
    .ConfigurePrimaryHttpMessageHandler(TransportePush.CrearManejador);
builder.Services.AddScoped<MaterializadorPush>();
builder.Services.AddScoped<DespachadorPush>();
builder.Services.AddScoped<TransportePush>();
if (!args.Contains("--export-swagger")) builder.Services.AddHostedService<ProcesadorOutbox>();

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

// Servir archivos estáticos subidos localmente (evidencias fotográficas médicas)
var rutaUploads = Path.Combine(app.Environment.ContentRootPath, "uploads");
if (!Directory.Exists(rutaUploads))
{
    Directory.CreateDirectory(rutaUploads);
}
var rutaEvidencias = Path.Combine(rutaUploads, "evidencias");
if (!Directory.Exists(rutaEvidencias))
{
    Directory.CreateDirectory(rutaEvidencias);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(rutaUploads),
    RequestPath = "/uploads"
});

app.Use(async (contexto, siguiente) =>
{
    if (!contexto.Request.Path.StartsWithSegments("/api/notificaciones")) { await siguiente(); return; }
    try
    {
        if (contexto.Request.ContentLength > 8192) { await ErroresPush.Enviar(contexto, 413, "La suscripción supera el tamaño permitido."); return; }
        await siguiente();
        if (contexto.Response.StatusCode >= 400 && !contexto.Response.HasStarted && contexto.Response.ContentLength is null or 0)
            await ErroresPush.Enviar(contexto, contexto.Response.StatusCode, "No se pudo completar la solicitud. Verifica tu sesión y los datos enviados.");
    }
    catch (Exception ex) when (!contexto.Response.HasStarted && !contexto.RequestAborted.IsCancellationRequested)
    {
        app.Logger.LogError("Error en notificaciones ({Tipo}).", ex.GetType().Name);
        await ErroresPush.Enviar(contexto, ex is BadHttpRequestException or global::System.Text.Json.JsonException ? 400 : 500,
            "No se pudo completar la solicitud de notificaciones. Revisa los datos e inténtalo de nuevo.");
    }
});
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

// Configurar serializador JSON de FastEndpoints: enums como string y case-insensitive
// para que el binding del request DTO acepte "estadoAnimo":"MuyMal" (PascalCase/camelCase
// desde el frontend) y lo convierta al enum correspondiente.
app.UseFastEndpoints(configuracion =>
{
    configuracion.Errors.ContentType = "application/problem+json";
    configuracion.Errors.ResponseBuilder = (fallos, contexto, codigo) => new Microsoft.AspNetCore.Mvc.ValidationProblemDetails(
        fallos.GroupBy(f => f.PropertyName).ToDictionary(g => g.Key, g => g.Select(f => f.ErrorMessage).ToArray()))
    {
        Status = codigo, Title = "Datos de solicitud inválidos", Detail = "Revisa los campos indicados y vuelve a intentarlo.",
        Type = "https://racpd.app/errors/validacion", Instance = contexto.Request.Path
    };
    configuracion.Serializer.Options.Converters.Add(new JsonStringEnumConverter());
    configuracion.Serializer.Options.PropertyNameCaseInsensitive = true;
});
app.UseSwaggerGen();

// Si se ejecuta con el flag '--export-swagger', exporta el esquema OpenAPI sin bloquear puertos fijos y finaliza
if (args.Contains("--export-swagger"))
{
    var rutaFrontend = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "RACPD.Frontend", "swagger.json"));
    Console.WriteLine($"[swagger:export] Generando esquema OpenAPI en: {rutaFrontend}...");

    // Iniciar en puerto efímero (0 = el SO asigna puerto libre disponible)
    app.Urls.Clear();
    app.Urls.Add("http://127.0.0.1:0");
    await app.StartAsync();

    var direccionEfectiva = app.Urls.First();
    using var httpClient = new HttpClient { BaseAddress = new Uri(direccionEfectiva) };
    var respuestaSwagger = await httpClient.GetStringAsync("/swagger/v1/swagger.json");

    await app.StopAsync();
    await File.WriteAllTextAsync(rutaFrontend, respuestaSwagger);

    Console.WriteLine("[swagger:export] ✔ Esquema OpenAPI exportado exitosamente.");
    return;
}

app.Run();


