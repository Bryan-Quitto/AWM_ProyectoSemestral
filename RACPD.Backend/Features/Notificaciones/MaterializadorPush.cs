using Microsoft.Extensions.Options;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RACPD.Backend.Data;
using RACPD.Backend.Domain.Entities;
using RACPD.Backend.Domain.Enums;
using RACPD.Backend.Infrastructure;
namespace RACPD.Backend.Features.Notificaciones;
public sealed class MaterializadorPush(AppDbContext db, IOptions<OpcionesPush> opciones)
{
    public async Task Ejecutar(CancellationToken ct)
    {
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);
            var limite = Math.Clamp(opciones.Value.Lote, 1, 200);
            var mensajes = await db.OutboxMensajes.FromSqlInterpolated($"""
                SELECT * FROM "OutboxMensajes"
                WHERE "Tipo" = 'BITACORA_ANIMO_CRITICO' AND NOT "Procesado" AND NOT "Fallo" AND NOT "DestinatariosResueltos"
                ORDER BY "Fecha", "Id" LIMIT {limite} FOR UPDATE SKIP LOCKED
                """).ParaJob().ToListAsync(ct);
            foreach (var mensaje in mensajes)
            {
                CargaAnimoCritico? carga;
                try { carga = JsonSerializer.Deserialize<CargaAnimoCritico>(mensaje.PayloadJson); }
                catch (JsonException) { carga = null; }
                var perfilId = carga == null ? Guid.Empty : await db.BitacorasTurno.ParaJob()
                    .Where(x => x.Id == carga.BitacoraId && x.BloqueTurnoId == carga.BloqueId
                        && x.RegistradoPorUsuarioId == carga.RegistradoPorId && x.Activa
                        && (x.EstadoAnimo == EstadoAnimoTurno.Mal || x.EstadoAnimo == EstadoAnimoTurno.MuyMal))
                    .Select(x => x.BloqueTurno.PerfilDependienteId).SingleOrDefaultAsync(ct);
                if (mensaje.VersionCarga != 1 || carga == null || carga.EstadoAnimo is not ("Mal" or "MuyMal") || perfilId == Guid.Empty)
                {
                    mensaje.Fallo = true;
                    mensaje.Procesado = true;
                    mensaje.FechaProcesamiento = DateTimeOffset.UtcNow;
                    mensaje.UltimoErrorClasificado = "CargaInvalida";
                    continue;
                }
                var usuarios = db.VinculosDependientes.ParaJob().Where(v => v.PerfilDependienteId == perfilId && v.Activo
                    && (v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal || v.RolEnDependiente == RolEnDependiente.Apoyo)
                    && v.Usuario.Estado == EstadoUsuario.Activo).Select(v => v.UsuarioId);
                var ids = await db.SuscripcionesPush.ParaJob().Where(x => x.Activa && usuarios.Contains(x.UsuarioId)).Select(x => x.Id).ToListAsync(ct);
                foreach (var id in ids) db.EntregasPush.Add(new EntregaPush { OutboxMensajeId = mensaje.Id, SuscripcionPushId = id, PerfilDependienteId = perfilId });
                mensaje.DestinatariosResueltos = true;
                if (ids.Count == 0)
                {
                    mensaje.Procesado = true;
                    mensaje.FechaProcesamiento = DateTimeOffset.UtcNow;
                    mensaje.UltimoErrorClasificado = "SinDestinatariosSuscritos";
                }
            }
            await db.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
        });
    }
}
