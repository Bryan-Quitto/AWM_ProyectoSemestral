import { useNotificacionesPush } from '../../features/notificaciones/hooks/useNotificacionesPush'
export function NotificacionesDesktop() {
  const { activa, operacion, error, mensaje, cambiar, deshabilitado } = useNotificacionesPush()
  return <section aria-labelledby="titulo-push-desktop" className="rounded-xl border border-sky-100 bg-white p-6 shadow-sm">
    <h2 id="titulo-push-desktop" className="text-lg font-semibold text-blue-900">Notificaciones</h2>
    <p className="mt-2 text-sm text-blue-800" role="status">{mensaje}</p>
    <p className="mt-2 text-sm text-slate-600">Los avisos llegan al Cuidador Principal y a los Apoyos vinculados. El contenido de salud se consulta dentro de la aplicación.</p>
    <button type="button" onClick={() => void cambiar()} disabled={deshabilitado} aria-busy={!!operacion}
      className="mt-4 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      {operacion === 'activando' ? 'Activando…' : operacion === 'desactivando' ? 'Desactivando…' : activa ? 'Desactivar este dispositivo' : 'Activar este dispositivo'}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>
}
