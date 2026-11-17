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
                WHERE "Tipo" IN ('BITACORA_ANIMO_CRITICO', 'ALERTA_SOS_URGENTE')
                  AND NOT "Procesado" AND NOT "Fallo" AND NOT "DestinatariosResueltos"
                ORDER BY "Fecha", "Id" LIMIT {limite} FOR UPDATE SKIP LOCKED
                """).ParaJob().ToListAsync(ct);
            foreach (var mensaje in mensajes)
            {
                if (mensaje.Tipo == "ALERTA_SOS_URGENTE")
                {
                    CargaAlertaSos? cargaSos;
                    try { cargaSos = JsonSerializer.Deserialize<CargaAlertaSos>(mensaje.PayloadJson); }
                    catch (JsonException) { cargaSos = null; }

                    var emisorAutorizado = cargaSos != null
                        && cargaSos.PerfilDependienteId != Guid.Empty
                        && await db.VinculosDependientes.ParaJob().AnyAsync(v =>
                            v.PerfilDependienteId == cargaSos.PerfilDependienteId
                            && v.UsuarioId == cargaSos.EmitidoPorUsuarioId
                            && v.Activo
                            && v.Usuario.Estado == EstadoUsuario.Activo, ct);

                    if (mensaje.VersionCarga != 1 || cargaSos == null || !emisorAutorizado)
                    {
                        mensaje.Fallo = true;
                        mensaje.Procesado = true;
                        mensaje.FechaProcesamiento = DateTimeOffset.UtcNow;
                        mensaje.UltimoErrorClasificado = "CargaInvalida";
                        continue;
                    }

                    // Identifica a familiares con rol Apoyo vinculados al dependiente activo
                    // (y también a CuidadorPrincipal si el emisor fue Apoyo, excluyendo al propio emisor).
                    var usuariosSos = db.VinculosDependientes.ParaJob().Where(v =>
                        v.PerfilDependienteId == cargaSos.PerfilDependienteId
                        && v.Activo
                        && v.UsuarioId != cargaSos.EmitidoPorUsuarioId
                        && (v.RolEnDependiente == RolEnDependiente.Apoyo || v.RolEnDependiente == RolEnDependiente.CuidadorPrincipal)
                        && v.Usuario.Estado == EstadoUsuario.Activo).Select(v => v.UsuarioId);

                    var idsSos = await db.SuscripcionesPush.ParaJob()
                        .Where(x => x.Activa && usuariosSos.Contains(x.UsuarioId))
                        .Select(x => x.Id)
                        .ToListAsync(ct);

                    foreach (var id in idsSos)
                        db.EntregasPush.Add(new EntregaPush { OutboxMensajeId = mensaje.Id, SuscripcionPushId = id, PerfilDependienteId = cargaSos.PerfilDependienteId });

                    mensaje.DestinatariosResueltos = true;
                    if (idsSos.Count == 0)
                    {
                        mensaje.Procesado = true;
                        mensaje.FechaProcesamiento = DateTimeOffset.UtcNow;
                        mensaje.UltimoErrorClasificado = "SinDestinatariosSuscritos";
                    }
                    continue;
                }

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
