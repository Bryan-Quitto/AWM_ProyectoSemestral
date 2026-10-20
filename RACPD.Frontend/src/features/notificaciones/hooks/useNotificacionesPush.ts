import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { supabase } from '../../../lib/supabase'
import { useRACPDBackendFeaturesNotificacionesConfiguracionNotificacionesEndpoint } from '../../../api/generated/api/api'
import { claveAplicacion, desvincularPush, guardarSuscripcion, leerRegistroPush, soportaPush, retirarSuscripcionAjena } from '../dispositivoPush'

export function useNotificacionesPush() {
  const { data: usuarioId } = useSWR('push:cuenta', async () => (await supabase.auth.getSession()).data.session?.user.id ?? null)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      void mutate('push:cuenta', sesion?.user.id ?? null, { revalidate: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const compatible = soportaPush()
  const idSuscripcion = leerRegistroPush()?.usuarioId === usuarioId ? leerRegistroPush()?.id : undefined
  const { data: configuracion, isLoading: cargando, error: errorConfiguracion, mutate: refrescarConfiguracion } = useRACPDBackendFeaturesNotificacionesConfiguracionNotificacionesEndpoint({ idSuscripcion }, {
    swr: { enabled: !!usuarioId, swrKey: usuarioId ? ['push:configuracion', usuarioId, idSuscripcion] : null },
  })
  const { data: dispositivo, mutate: refrescar } = useSWR(usuarioId ? ['push:dispositivo', usuarioId] : null, async () => {
    if (!compatible) return { permiso: 'default', activa: false }
    const registro = leerRegistroPush()
    const trabajador = await navigator.serviceWorker.getRegistration()
    const suscripcion = await trabajador?.pushManager.getSubscription()
    return { permiso: Notification.permission, activa: !!suscripcion && registro !== null && registro.usuarioId === usuarioId && registro.destino === suscripcion.endpoint }
  })
  const [operacion, setOperacion] = useState<'activando' | 'desactivando' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const disponible = configuracion?.status === 200 && configuracion.data.disponible
  const activa = dispositivo?.activa === true && dispositivo.permiso === 'granted' && configuracion?.status === 200 && configuracion.data.suscripcionActiva
  const bloqueado = compatible && dispositivo?.permiso === 'denied'
  const cambiar = async () => {
    if (!usuarioId || operacion) return
    setError(null)
    setOperacion(activa ? 'desactivando' : 'activando')
    try {
      if (activa) await desvincularPush()
      else {
        const permiso = await Notification.requestPermission()
        if (permiso !== 'granted') throw new Error('No se concedió permiso. Puedes cambiarlo en los ajustes del navegador.')
        if (configuracion?.status !== 200 || !configuracion.data.clavePublicaVapid) throw new Error('El servicio de notificaciones no está configurado.')
        await retirarSuscripcionAjena(usuarioId)
        const trabajador = await navigator.serviceWorker.getRegistration()
        if (!trabajador?.active) throw new Error('La aplicación aún se está preparando. Recarga e inténtalo de nuevo.')
        const suscripcion = await trabajador.pushManager.getSubscription() ?? await trabajador.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveAplicacion(configuracion.data.clavePublicaVapid) })
        await guardarSuscripcion(suscripcion, usuarioId)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar este dispositivo. Revisa tu conexión y reintenta.') }
    finally { setOperacion(null); await Promise.all([refrescar(), refrescarConfiguracion()]) }
  }
  const mensaje = !compatible ? 'Este navegador necesita HTTPS y compatibilidad con notificaciones push.'
    : bloqueado ? 'El permiso está bloqueado. Habilítalo desde los ajustes del navegador.'
    : activa ? 'Las notificaciones están activadas para tu cuenta en este dispositivo.'
    : cargando ? 'Comprobando disponibilidad…'
    : !disponible || errorConfiguracion ? 'El servicio no está disponible. Puedes seguir usando la aplicación.'
    : 'Activa este dispositivo para recibir avisos importantes de tu red de cuidados.'
  return { activa, operacion, error, mensaje, cambiar, deshabilitado: !!operacion || !compatible || bloqueado || !usuarioId || (!activa && !disponible) }
}
