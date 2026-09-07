import { useEffect, useRef, useState } from 'react'

/**
 * Estado posible de la conexión de la aplicación.
 * - 'online'         : todo OK (red + backend responden).
 * - 'sin-internet'   : el navegador reporta que no hay red.
 * - 'backend-caido'  : hay red pero los fetches al backend están fallando.
 */
export type EstadoConexion = 'online' | 'sin-internet' | 'backend-caido'

type Opciones = {
  /** Umbral de fallos consecutivos para marcar el backend como caído. */
  umbralFallos?: number
  /** Ventana en ms para resetear el contador si hubo algún éxito. */
  ventanaMs?: number
}

/**
 * Devuelve true si el error parece ser de red transitorio.
 * Evita tragarnos errores reales (4xx, 5xx con respuesta, errores de lógica).
 */
const esErrorDeRed = (err: unknown): boolean => {
  if (!err) return false
  // TypeError "Failed to fetch" / "NetworkError" / "Load failed" del navegador.
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    )
  }
  // Algunas libs lanzan DOMException con name 'AbortError' / 'NetworkError'.
  if (
    typeof DOMException !== 'undefined' &&
    err instanceof DOMException &&
    (err.name === 'NetworkError' || err.name === 'AbortError')
  ) {
    return true
  }
  return false
}

/**
 * Hook agnóstico que monitorea:
 * 1. Estado de red del navegador (online/offline).
 * 2. Errores de fetch global (para detectar backend caído).
 * 3. `unhandledrejection` con errores de red: los silencia porque ya
 *    informamos al usuario mediante el banner ámbar (IndicadorConexion).
 *
 * Estrategia no-invasiva: NO modifica el cliente SWR ni el fetch global
 * más allá de envolverlo para contar fallos/éxitos.
 */
export const useEstadoConexion = (opciones: Opciones = {}) => {
  const { umbralFallos = 3, ventanaMs = 15_000 } = opciones

  const [estado, setEstado] = useState<EstadoConexion>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine
      ? 'sin-internet'
      : 'online'
  )

  const fallosRef = useRef(0)
  const ultimoFalloRef = useRef<number>(0)
  const estadoRef = useRef<EstadoConexion>(estado)

  // Mantenemos estadoRef sincronizado con el último estado, pero en un
  // effect para no tocar refs durante el render.
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  // 1) Eventos online/offline del navegador
  useEffect(() => {
    const handleOnline = () => {
      // Volvió la red; dejamos que los fetches confirmen si el backend responde.
      fallosRef.current = 0
      setEstado('online')
    }
    const handleOffline = () => setEstado('sin-internet')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 2) Parche de fetch + 3) silenciador de unhandledrejection (una sola vez)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      __racpdFetchPatch?: boolean
      __racpdUnhandledPatch?: boolean
    }
    if (!w.__racpdFetchPatch) {
      w.__racpdFetchPatch = true
      const originalFetch = window.fetch.bind(window)

      window.fetch = async (...args) => {
        const url =
          typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
        // Solo nos interesan llamadas al backend (relativas o localhost).
        const esBackend =
          url.startsWith('/api/') ||
          url.startsWith('/auth/') ||
          url.includes('supabase') ||
          url.includes('localhost') ||
          url.includes('127.0.0.1')
        if (!esBackend) {
          return originalFetch(...args)
        }

        try {
          const res = await originalFetch(...args)
          if (res.ok) {
            fallosRef.current = 0
            if (navigator.onLine) setEstado('online')
          }
          return res
        } catch (err) {
          const ahora = Date.now()
          if (ahora - ultimoFalloRef.current > ventanaMs) {
            fallosRef.current = 0
          }
          ultimoFalloRef.current = ahora
          fallosRef.current += 1

          if (!navigator.onLine) {
            setEstado('sin-internet')
          } else if (fallosRef.current >= umbralFallos) {
            setEstado('backend-caido')
          }
          throw err
        }
      }
    }

    if (!w.__racpdUnhandledPatch) {
      w.__racpdUnhandledPatch = true
      // Silencia "Failed to fetch" cuando ya sabemos que no hay red o
      // que el backend está caído. Errores reales (lógica, validación, etc.)
      // siguen apareciendo en consola.
      window.addEventListener(
        'unhandledrejection',
        (event: PromiseRejectionEvent) => {
          const estadoActual = estadoRef.current
          if (
            estadoActual !== 'online' &&
            esErrorDeRed(event.reason)
          ) {
            event.preventDefault()
          }
        }
      )
    }

    return () => {
      // No revertimos nada en unmount: son patches de aplicación.
    }
  }, [umbralFallos, ventanaMs])

  return { estado }
}
