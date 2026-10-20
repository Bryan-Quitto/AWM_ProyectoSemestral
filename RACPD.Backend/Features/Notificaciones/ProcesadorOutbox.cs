using Microsoft.Extensions.Options;
namespace RACPD.Backend.Features.Notificaciones;
public sealed class ProcesadorOutbox(IServiceScopeFactory fabrica, IOptions<OpcionesPush> opciones, ILogger<ProcesadorOutbox> registro) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!opciones.Value.Disponible) { registro.LogWarning("Push desactivado: configura NotificacionesPush antes de iniciar el servicio."); return; }
        using var reloj = new PeriodicTimer(TimeSpan.FromSeconds(Math.Clamp(opciones.Value.IntervaloSegundos, 1, 60)));
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = fabrica.CreateScope();
                await scope.ServiceProvider.GetRequiredService<MaterializadorPush>().Ejecutar(ct);
                var despachador = scope.ServiceProvider.GetRequiredService<DespachadorPush>();
                var entregas = await despachador.Reclamar(ct);
                await Parallel.ForEachAsync(entregas, new ParallelOptions { CancellationToken = ct, MaxDegreeOfParallelism = Math.Clamp(opciones.Value.Concurrencia, 1, 16) }, async (entrega, token) =>
                {
                    using var envio = fabrica.CreateScope();
                    await envio.ServiceProvider.GetRequiredService<DespachadorPush>().Enviar(entrega, token);
                });
                await despachador.Finalizar(ct);
                if (entregas.Count > 0) registro.LogInformation("Ciclo push: {Cantidad} entregas procesadas; consulta EntregasPush para sus resultados.", entregas.Count);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { registro.LogError("Falló el ciclo Outbox ({Tipo}); se recuperará en el próximo ciclo.", ex.GetType().Name); }
            try { if (!await reloj.WaitForNextTickAsync(ct)) break; }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
        }
    }
}
