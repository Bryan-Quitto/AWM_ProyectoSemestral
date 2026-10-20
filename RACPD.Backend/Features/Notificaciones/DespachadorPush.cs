using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;
namespace RACPD.Backend.Features.Notificaciones;
public sealed class DespachadorPush(AppDbContext db, TransportePush transporte, IOptions<OpcionesPush> opciones, ILogger<DespachadorPush> registro)
{
    public async Task<List<EntregaPush>> Reclamar(CancellationToken ct)
    {
        var reclamadas = new List<EntregaPush>();
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);
            var ahora = DateTimeOffset.UtcNow;
            var limite = Math.Clamp(opciones.Value.Concurrencia, 1, 16);
            reclamadas = await db.EntregasPush.FromSqlInterpolated($"""
                SELECT * FROM "EntregasPush"
                WHERE ("Estado" = 'Pendiente' AND "ProximoIntento" <= {ahora})
                   OR ("Estado" = 'EnProceso' AND "ArrendamientoHasta" <= {ahora})
                ORDER BY "ProximoIntento", "Id" LIMIT {limite} FOR UPDATE SKIP LOCKED
                """).ParaJob().ToListAsync(ct);
            foreach (var entrega in reclamadas)
            {
                entrega.Estado = EstadoEntregaPush.EnProceso;
                entrega.TokenReclamacion = Guid.NewGuid();
                entrega.ArrendamientoHasta = ahora.AddSeconds(60);
                entrega.Intentos++;
            }
            await db.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
        });
        return reclamadas;
    }
    public async Task Enviar(EntregaPush entrega, CancellationToken ct)
    {
        db.ChangeTracker.Clear();
        var suscripcion = await db.SuscripcionesPush.ParaJob().AsNoTracking().SingleOrDefaultAsync(x => x.Id == entrega.SuscripcionPushId && x.Activa, ct);
        var autorizado = suscripcion != null && await db.VinculosDependientes.ParaJob().AnyAsync(x => x.UsuarioId == suscripcion.UsuarioId
            && x.PerfilDependienteId == entrega.PerfilDependienteId && x.Activo && x.Usuario.Estado == EstadoUsuario.Activo
            && (x.RolEnDependiente == RolEnDependiente.CuidadorPrincipal || x.RolEnDependiente == RolEnDependiente.Apoyo), ct);
        var cargaJson = await db.OutboxMensajes.ParaJob().Where(x => x.Id == entrega.OutboxMensajeId).Select(x => x.PayloadJson).SingleAsync(ct);
        var carga = JsonSerializer.Deserialize<CargaAnimoCritico>(cargaJson);
        var ruta = carga == null ? "/agenda" : $"/agenda?bloqueIdDestacado={carga.BloqueId:D}";
        var resultado = autorizado && suscripcion != null
            ? await transporte.Enviar(suscripcion, entrega.OutboxMensajeId, ruta, ct)
            : new ResultadoEnvioPush(null, "SinAutorizacion");
        if (resultado.Error == "ConfiguracionVapidRechazada") registro.LogWarning("El proveedor rechazó VAPID. Revisa las credenciales del servidor antes de agotar los reintentos.");
        var codigo = resultado.Codigo;
        var aceptada = codigo >= 200 && codigo <= 299;
        var descartar = resultado.Error == "SinAutorizacion" || codigo is 404 or 410;
        var permanente = resultado.Error is "DestinoNoPermitido" or "SuscripcionInvalida" || (codigo >= 300 && codigo < 500 && codigo is not (401 or 403 or 408 or 429));
        var terminal = aceptada || descartar || permanente || entrega.Intentos >= Math.Clamp(opciones.Value.MaximoIntentos, 1, 20);
        var estado = aceptada ? EstadoEntregaPush.Aceptada : descartar ? EstadoEntregaPush.Descartada : terminal ? EstadoEntregaPush.Fallida : EstadoEntregaPush.Pendiente;
        var ahora = DateTimeOffset.UtcNow;
        var espera = resultado.Espera is { } solicitada && solicitada > TimeSpan.Zero ? solicitada
            : TimeSpan.FromSeconds(Math.Min(3600, Math.Pow(2, entrega.Intentos) * 5) + Random.Shared.Next(5));
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);
            var cambios = await db.EntregasPush.ParaJob().Where(x => x.Id == entrega.Id && x.TokenReclamacion == entrega.TokenReclamacion && x.Estado == EstadoEntregaPush.EnProceso)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Estado, estado).SetProperty(x => x.TokenReclamacion, (Guid?)null)
                    .SetProperty(x => x.ArrendamientoHasta, (DateTimeOffset?)null).SetProperty(x => x.ProximoIntento, ahora.Add(espera))
                    .SetProperty(x => x.FechaAceptacion, aceptada ? ahora : (DateTimeOffset?)null)
                    .SetProperty(x => x.UltimoCodigoHttp, codigo).SetProperty(x => x.UltimoErrorClasificado, resultado.Error), ct);
            if (cambios > 0 && codigo is 404 or 410)
                await db.SuscripcionesPush.ParaJob().Where(x => x.Id == entrega.SuscripcionPushId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Activa, false), ct);
            await transaccion.CommitAsync(ct);
        });
    }
    public Task<int> Finalizar(CancellationToken ct) => db.Database.ExecuteSqlRawAsync("""
        UPDATE "OutboxMensajes" m SET "Procesado" = true, "FechaProcesamiento" = NOW(),
            "Fallo" = EXISTS (SELECT 1 FROM "EntregasPush" e WHERE e."OutboxMensajeId" = m."Id" AND e."Estado" = 'Fallida'),
            "UltimoErrorClasificado" = CASE WHEN EXISTS (SELECT 1 FROM "EntregasPush" e WHERE e."OutboxMensajeId" = m."Id" AND e."Estado" = 'Fallida') THEN 'EntregasFallidas' ELSE NULL END
        WHERE m."Tipo" = 'BITACORA_ANIMO_CRITICO' AND m."DestinatariosResueltos" AND NOT m."Procesado"
        AND NOT EXISTS (SELECT 1 FROM "EntregasPush" e WHERE e."OutboxMensajeId" = m."Id" AND e."Estado" IN ('Pendiente', 'EnProceso'))
        """, ct);
}
