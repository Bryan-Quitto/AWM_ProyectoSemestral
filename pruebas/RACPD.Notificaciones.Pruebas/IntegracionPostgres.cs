using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.AspNetCore.WebUtilities;
using System.Security.Cryptography;
using WebPush;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Features.Notificaciones;

static class IntegracionPostgres
{
    public static async Task Ejecutar()
    {
        var cadena = Environment.GetEnvironmentVariable("RACPD_PRUEBAS_DB");
        if (string.IsNullOrWhiteSpace(cadena))
        {
            Console.WriteLine("PENDIENTE: integración PostgreSQL. Define RACPD_PRUEBAS_DB apuntando exclusivamente a una base de pruebas.");
            return;
        }
        var esquema = "racpd_pruebas_" + Guid.NewGuid().ToString("N");
        var conexion = new NpgsqlConnectionStringBuilder(cadena) { SearchPath = esquema };
        var opcionesDb = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(conexion.ConnectionString).Options;
        await using var administrador = new NpgsqlConnection(cadena);
        await administrador.OpenAsync();
        await using (var crear = new NpgsqlCommand($"CREATE SCHEMA {esquema}", administrador)) await crear.ExecuteNonQueryAsync();
        try
        {
            await using var db = new AppDbContext(opcionesDb);
            await ProbarMigracion(opcionesDb);
            await db.Database.ExecuteSqlRawAsync(db.Database.GenerateCreateScript());
            var principal = new Usuario { Id = Guid.NewGuid(), Nombre = "Principal", Estado = EstadoUsuario.Activo, Rol = Rol.Apoyo };
            var apoyo = new Usuario { Id = Guid.NewGuid(), Nombre = "Apoyo", Estado = EstadoUsuario.Activo, Rol = Rol.CuidadorPrincipal };
            var ajeno = new Usuario { Id = Guid.NewGuid(), Nombre = "Ajeno", Estado = EstadoUsuario.Activo };
            db.Usuarios.AddRange(principal, apoyo, ajeno);
            var perfil = new PerfilDependiente { CreadoPorUsuarioId = principal.Id };
            db.PerfilesDependientes.Add(perfil);
            var vinculoApoyo = new VinculoDependiente(apoyo.Id, perfil.Id, RolEnDependiente.Apoyo);
            db.VinculosDependientes.AddRange(new VinculoDependiente(principal.Id, perfil.Id, RolEnDependiente.CuidadorPrincipal), vinculoApoyo);
            var bloque = new BloqueTurno { Id = Guid.NewGuid(), PerfilDependienteId = perfil.Id, CreadoPorId = principal.Id, Fecha = new DateOnly(2026, 10, 20) };
            db.BloquesTurno.Add(bloque);
            var bitacora = new BitacoraTurno(bloque.Id, principal.Id, EstadoAnimoTurno.Mal, null, null, null, []);
            db.BitacorasTurno.Add(bitacora);
            var mensaje = new OutboxMensaje { Tipo = "BITACORA_ANIMO_CRITICO", PayloadJson = JsonSerializer.Serialize(new CargaAnimoCritico(bitacora.Id, bloque.Id, principal.Id, "Mal", bitacora.FechaCierre)) };
            db.OutboxMensajes.Add(mensaje);
            var clavesDispositivo = VapidHelper.GenerateVapidKeys();
            var suscripciones = new[] { principal.Id, apoyo.Id, ajeno.Id }.Select((id, i) => new SuscripcionPush { UsuarioId = id, HuellaDestino = i.ToString(), UrlDestino = "https://fcm.googleapis.com/prueba/" + i, ClavePublica = clavesDispositivo.PublicKey, SecretoAutenticacion = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(16)) }).ToArray();
            db.SuscripcionesPush.AddRange(suscripciones);
            await db.SaveChangesAsync();
            await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
            {
                await using var paralelo = new AppDbContext(opcionesDb);
                await new MaterializadorPush(paralelo, Options.Create(new OpcionesPush())).Ejecutar(CancellationToken.None);
            }));
            if (await db.EntregasPush.CountAsync() != 2) throw new InvalidOperationException("Destinatarios incorrectos o duplicados entre workers.");
            var vapid = VapidHelper.GenerateVapidKeys();
            var configuracion = Options.Create(new OpcionesPush { Concurrencia = 1, ClavePublica = vapid.PublicKey, ClavePrivada = vapid.PrivateKey, Asunto = "mailto:pruebas@example.com" });
            var fabrica = new FabricaPrueba();
            var transporte = new TransportePush(fabrica, configuracion);
            await using var otro = new AppDbContext(opcionesDb);
            var despachador = new DespachadorPush(db, transporte, configuracion, NullLogger<DespachadorPush>.Instance);
            var despachadorOtro = new DespachadorPush(otro, transporte, configuracion, NullLogger<DespachadorPush>.Instance);
            var reclamos = await Task.WhenAll(despachador.Reclamar(CancellationToken.None), despachadorOtro.Reclamar(CancellationToken.None));
            if (reclamos.Any(x => x.Count != 1) || reclamos[0][0].Id == reclamos[1][0].Id) throw new InvalidOperationException("La reclamación no es exclusiva.");
            var anterior = reclamos[0][0];
            await db.EntregasPush.Where(x => x.Id == anterior.Id).ExecuteUpdateAsync(x => x.SetProperty(e => e.ArrendamientoHasta, DateTimeOffset.UtcNow.AddMinutes(-1)));
            var recuperadas = await despachador.Reclamar(CancellationToken.None);
            if (recuperadas.Count != 1 || recuperadas[0].Id != anterior.Id || recuperadas[0].TokenReclamacion == anterior.TokenReclamacion) throw new InvalidOperationException("No recuperó arrendamiento vencido.");
            // Revocar el vínculo antes de enviar debe descartar sin tocar la red.
            await db.VinculosDependientes.Where(x => x.PerfilDependienteId == perfil.Id).ExecuteUpdateAsync(x => x.SetProperty(v => v.Activo, false));
            await despachador.Enviar(recuperadas[0], CancellationToken.None);
            db.ChangeTracker.Clear();
            if (await db.EntregasPush.Where(x => x.Id == anterior.Id).Select(x => x.Estado).SingleAsync() != EstadoEntregaPush.Descartada || fabrica.Manejador.Llamadas != 0)
                throw new InvalidOperationException("Envió después de revocar autorización.");
            await despachadorOtro.Enviar(reclamos[1][0], CancellationToken.None);
            await despachador.Finalizar(CancellationToken.None);
            await db.VinculosDependientes.Where(x => x.PerfilDependienteId == perfil.Id).ExecuteUpdateAsync(x => x.SetProperty(v => v.Activo, true));
            var segundo = new OutboxMensaje { Tipo = mensaje.Tipo, PayloadJson = mensaje.PayloadJson };
            db.OutboxMensajes.Add(segundo);
            await db.SaveChangesAsync();
            await new MaterializadorPush(db, configuracion).Ejecutar(CancellationToken.None);
            var aceptada = (await despachador.Reclamar(CancellationToken.None)).Single();
            fabrica.Manejador.Codigo = 201;
            await despachador.Enviar(aceptada, CancellationToken.None);
            var transitoria = (await despachador.Reclamar(CancellationToken.None)).Single();
            fabrica.Manejador.Codigo = 500;
            await despachador.Enviar(transitoria, CancellationToken.None);
            await despachador.Finalizar(CancellationToken.None);
            db.ChangeTracker.Clear();
            if (await db.OutboxMensajes.Where(x => x.Id == segundo.Id).Select(x => x.Procesado).SingleAsync()) throw new InvalidOperationException("Finalizó antes del reintento pendiente.");
            if (await db.EntregasPush.Where(x => x.Id == transitoria.Id).Select(x => x.Estado).SingleAsync() != EstadoEntregaPush.Pendiente) throw new InvalidOperationException("No programó reintento de 500.");
            await db.EntregasPush.Where(x => x.Id == transitoria.Id).ExecuteUpdateAsync(x => x.SetProperty(e => e.ProximoIntento, DateTimeOffset.UtcNow.AddSeconds(-1)));
            var reintento = (await despachador.Reclamar(CancellationToken.None)).Single();
            if (reintento.Id == aceptada.Id) throw new InvalidOperationException("Repitió entrega aceptada.");
            fabrica.Manejador.Codigo = 410;
            await despachador.Enviar(reintento, CancellationToken.None);
            await despachador.Finalizar(CancellationToken.None);
            db.ChangeTracker.Clear();
            if (await db.SuscripcionesPush.Where(x => x.Id == reintento.SuscripcionPushId).Select(x => x.Activa).SingleAsync()) throw new InvalidOperationException("No desactivó destino vencido.");
            if (!await db.OutboxMensajes.Where(x => x.Id == segundo.Id).Select(x => x.Procesado).SingleAsync()) throw new InvalidOperationException("No finalizó evento con entregas terminales.");
            Console.WriteLine("Correcto: PostgreSQL valida destinatarios, idempotencia, workers concurrentes, recuperación, revocación, fallos parciales, reintentos y baja de destinos vencidos.");
        }
        finally
        {
            // Nombre generado internamente; nunca se elimina una base ni un esquema del usuario.
            if (!esquema.StartsWith("racpd_pruebas_") || esquema.Length != 46) throw new InvalidOperationException("Esquema de limpieza inválido.");
            await using var borrar = new NpgsqlCommand($"DROP SCHEMA {esquema} CASCADE", administrador);
            await borrar.ExecuteNonQueryAsync();
        }
    }
    private static async Task ProbarMigracion(DbContextOptions<AppDbContext> opciones)
    {
        await using var db = new AppDbContext(opciones);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE "Usuarios" ("Id" uuid PRIMARY KEY);
            CREATE TABLE "OutboxMensajes" (
                "Id" uuid PRIMARY KEY, "Tipo" text NOT NULL, "PayloadJson" jsonb NOT NULL,
                "Fecha" timestamptz NOT NULL, "Procesado" boolean NOT NULL, "Intentos" integer NOT NULL, "Fallo" boolean NOT NULL);
            INSERT INTO "OutboxMensajes" VALUES ('a054ff39-dbe6-485d-9c6d-0cc60e8f159b', 'BITACORA_ANIMO_CRITICO', '{{}}', NOW(), false, 0, false);
            """);
        var ensamblado = db.GetService<IMigrationsAssembly>();
        var tipo = ensamblado.Migrations.Single(x => x.Key.EndsWith("_AgregarNotificacionesPush")).Value;
        var migracion = ensamblado.CreateMigration(tipo, db.Database.ProviderName ?? throw new InvalidOperationException("Falta proveedor"));
        foreach (var comando in db.GetService<IMigrationsSqlGenerator>().Generate(migracion.UpOperations, db.Model))
            await db.Database.ExecuteSqlRawAsync(comando.CommandText);
        var version = await db.OutboxMensajes.Select(x => x.VersionCarga).SingleAsync();
        if (version != 1) throw new InvalidOperationException("La migración invalida los mensajes anteriores.");
        foreach (var comando in db.GetService<IMigrationsSqlGenerator>().Generate(migracion.DownOperations, db.Model))
            await db.Database.ExecuteSqlRawAsync(comando.CommandText);
        await db.Database.ExecuteSqlRawAsync("""DROP TABLE "OutboxMensajes"; DROP TABLE "Usuarios";""");
        Console.WriteLine("Correcto: migración push aplicada y revertida, conservando versión 1 en eventos anteriores.");
    }

}
