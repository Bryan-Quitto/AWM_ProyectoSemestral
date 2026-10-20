import useSWR from 'swr'
export const ID = 'a054ff39-dbe6-485d-9c6d-0cc60e8f159b'
let activa = false
export function useRACPDBackendFeaturesNotificacionesConfiguracionNotificacionesEndpoint(parametros?: { idSuscripcion?: string }, opciones?: { swr?: { swrKey?: unknown; enabled?: boolean } }) {
  return useSWR(opciones?.swr?.enabled === false ? null : ['configuracion-prueba', parametros?.idSuscripcion], async () => ({ status: 200, data: { disponible: true, clavePublicaVapid: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', suscripcionActiva: activa && parametros?.idSuscripcion === ID } }))
}
export async function rACPDBackendFeaturesNotificacionesSuscribirNotificacionesEndpoint() {
  if (new URLSearchParams(location.search).get('escenario') === 'error') return { status: 503, data: { detail: 'Servidor de prueba no disponible. Reintenta.' } }
  activa = true
  return { status: 200, data: { id: ID, activa: true } }
}
export async function rACPDBackendFeaturesNotificacionesDesuscribirNotificacionesEndpoint() {
  activa = false
  return { status: 200, data: { id: ID, activa: false } }
}
