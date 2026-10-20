import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import {
  rACPDBackendFeaturesNotificacionesSuscribirNotificacionesEndpoint as suscribir,
  rACPDBackendFeaturesNotificacionesDesuscribirNotificacionesEndpoint as desuscribir,
} from '../../api/generated/api/api'

const registroSchema = z.object({ usuarioId: z.string().uuid(), id: z.string().uuid(), destino: z.string().url() }).strict()
const respuestaSchema = z.object({ id: z.string().uuid(), activa: z.boolean() }).strict()
const problemaSchema = z.object({ detail: z.string().optional() }).passthrough()
const CLAVE = 'racpd:push:dispositivo'
export const soportaPush = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export function leerRegistroPush() {
  try { const r = registroSchema.safeParse(JSON.parse(localStorage.getItem(CLAVE) ?? 'null')); return r.success ? r.data : null }
  catch { return null }
}
export function comprobarRespuesta(respuesta: { status: number; data: unknown }) {
  if (respuesta.status !== 200) {
    const problema = problemaSchema.safeParse(respuesta.data)
    throw new Error(problema.success ? problema.data.detail ?? 'No se pudo guardar la suscripción.' : 'No se pudo guardar la suscripción.')
  }
  return respuestaSchema.parse(respuesta.data)
}
export async function guardarSuscripcion(suscripcion: PushSubscription, usuarioId: string) {
  const anterior = leerRegistroPush()
  if (anterior && anterior.usuarioId !== usuarioId) throw new Error('Este navegador pertenece a otra cuenta. Cierra su sesión y desvincula las notificaciones primero.')
  const convertir = (clave: ArrayBuffer | null) => {
    if (!clave) throw new Error('El navegador no proporcionó las claves de notificaciones.')
    return btoa(String.fromCharCode(...new Uint8Array(clave))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const resultado = comprobarRespuesta(await suscribir({ urlDestino: suscripcion.endpoint, clavePublica: convertir(suscripcion.getKey('p256dh')), secretoAutenticacion: convertir(suscripcion.getKey('auth')) }))
  if (!resultado.activa) throw new Error('La suscripción no quedó activa.')
  localStorage.setItem(CLAVE, JSON.stringify({ usuarioId, id: resultado.id, destino: suscripcion.endpoint }))
}
export async function desvincularPush() {
  if (!soportaPush()) return
  const registro = leerRegistroPush()
  const { data: { session } } = await supabase.auth.getSession()
  const trabajador = await navigator.serviceWorker.getRegistration()
  const suscripcion = await trabajador?.pushManager.getSubscription()
  if (registro && registro.usuarioId !== session?.user.id) {
    // Se retira el destino del navegador; la asociación ajena no se reasigna en el servidor.
    if (suscripcion && !await suscripcion.unsubscribe()) throw new Error('No se pudo retirar la suscripción anterior del navegador.')
    localStorage.removeItem(CLAVE)
    return
  }
  if (!registro && suscripcion && session) await guardarSuscripcion(suscripcion, session.user.id)
  const actual = leerRegistroPush()
  if (actual) comprobarRespuesta(await desuscribir({ idSuscripcion: actual.id }))
  if (suscripcion && !await suscripcion.unsubscribe()) throw new Error('La baja del servidor terminó; vuelve a intentar retirar la suscripción del navegador.')
  localStorage.removeItem(CLAVE)
}
export function claveAplicacion(valor: string): Uint8Array<ArrayBuffer> {
  const texto = valor.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(texto.padEnd(Math.ceil(texto.length / 4) * 4, '='))
  return Uint8Array.from(binario, c => c.charCodeAt(0))
}

export async function retirarSuscripcionAjena(usuarioId: string | null) {
  const registro = leerRegistroPush()
  if (!registro || registro.usuarioId === usuarioId || !soportaPush()) return
  const trabajador = await navigator.serviceWorker.getRegistration()
  const suscripcion = await trabajador?.pushManager.getSubscription()
  if (suscripcion && !await suscripcion.unsubscribe()) throw new Error('No se pudo desvincular el navegador de la cuenta anterior.')
  if (leerRegistroPush()?.id === registro.id) localStorage.removeItem(CLAVE)
}
