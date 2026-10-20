using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using RACPD.Backend.Data;
using RACPD.Backend.Features.Notificaciones;
using WebPush;

sealed class ServidorApiPrueba(DbContextOptions<AppDbContext> opcionesDb) : WebApplicationFactory<OpcionesPush>
{
    private readonly RsaSecurityKey clave = new(RSA.Create(2048)) { KeyId = "rsa-pruebas-aisladas" };
    public OpcionesPush Push { get; } = CrearPush();
    private static OpcionesPush CrearPush()
    {
        var claves = VapidHelper.GenerateVapidKeys();
        return new OpcionesPush { ClavePublica = claves.PublicKey, ClavePrivada = claves.PrivateKey, Asunto = "mailto:pruebas@example.invalid" };
    }
    protected override void ConfigureWebHost(IWebHostBuilder constructor)
    {
        constructor.UseEnvironment("Testing");
        constructor.ConfigureLogging(registro => registro.ClearProviders());
        constructor.ConfigureTestServices(servicios =>
        {
            servicios.RemoveAll<AppDbContext>();
            servicios.RemoveAll<DbContextOptions<AppDbContext>>();
            servicios.AddScoped(_ => new AppDbContext(opcionesDb));
            foreach (var servicio in servicios.Where(x => x.ServiceType == typeof(IHostedService) && x.ImplementationType == typeof(ProcesadorOutbox)).ToList()) servicios.Remove(servicio);
            servicios.PostConfigure<OpcionesPush>(o => { o.ClavePublica = Push.ClavePublica; o.ClavePrivada = Push.ClavePrivada; o.Asunto = Push.Asunto; });
            servicios.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, o =>
            {
                var configuracion = new OpenIdConnectConfiguration { Issuer = "https://identidad.pruebas.invalid" };
                configuracion.SigningKeys.Add(clave);
                o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(configuracion);
                o.TokenValidationParameters.ValidIssuer = configuracion.Issuer;
                o.TokenValidationParameters.ValidAudience = "authenticated";
                // Se conserva el manejador JWT real y la restricción RS256 de la aplicación.
            });
        });
    }
    public string Token(Guid usuarioId, bool vencido = false)
    {
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "https://identidad.pruebas.invalid", audience: "authenticated",
            claims: [new Claim("sub", usuarioId.ToString()), new Claim("role", "CuidadorPrincipal")],
            notBefore: DateTime.UtcNow.AddHours(-2), expires: vencido ? DateTime.UtcNow.AddHours(-1) : DateTime.UtcNow.AddMinutes(10),
            signingCredentials: new SigningCredentials(clave, SecurityAlgorithms.RsaSha256)));
    }
}
