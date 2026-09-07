import { useEffect, useReducer } from 'react'
import { WifiOff, ServerCrash, RefreshCw } from 'lucide-react'
import { useEstadoConexion, type EstadoConexion } from '../../hooks/useEstadoConexion'

const MENSAJES: Record<Exclude<EstadoConexion, 'online'>, {
  texto: string
  detalle: string
}> = {
  'sin-internet': {
    texto: 'Sin conexión a internet',
    detalle: 'Verifica tu red. Los cambios no se guardarán hasta volver.',
  },
  'backend-caido': {
    texto: 'No se puede contactar al servidor',
    detalle: 'Nuestros servicios no responden. Reintentaremos automáticamente.',
  },
}

/**
 * Devuelve `true` solo después de que `activo` haya sido `true`
 * de forma continua durante `delayMs`. Sirve para evitar parpadeo
 * en reconexiones rápidas.
 *
 * Implementación con `useReducer`:
 * - `reset` (cuando `activo` pasa a true): el banner se apaga y
 *   arranca el conteo del delay.
 * - `mostrar` (cuando el timer dispara): el banner se enciende.
 *
 * El reducer evita los `setState` directos en el effect del timer
 * (cumple la regla `react(set-state-in-effect)`) y tampoco lee
 * refs durante el render (cumple la regla `react(refs)`).
 *
 * Para "apagar" el banner cuando `activo` pasa a `false`, el padre
 * ya chequea `estado === 'online'` antes de mostrar; aquí solo
 * devolvemos `false` cuando el reducer está en estado inactivo
 * (es decir, sin timer pendiente o ya mostrado y luego reseteado).
 */
type Estado = 'inactivo' | 'mostrado'
type Accion = { tipo: 'reset' } | { tipo: 'mostrar' }

const reductor = (_estado: Estado, accion: Accion): Estado => {
  switch (accion.tipo) {
    case 'reset':
      return 'inactivo'
    case 'mostrar':
      return 'mostrado'
  }
}

const useDelayedTrue = (activo: boolean, delayMs: number) => {
  const [estado, dispatch] = useReducer(reductor, 'inactivo')

  // Cuando `activo` pasa a `true`, reseteamos para requerir el delay.
  // Esto ocurre en un effect para no setear state durante el render.
  useEffect(() => {
    if (activo) {
      dispatch({ tipo: 'reset' })
    }
  }, [activo])

  // Cuando `activo` es `true`, programamos el timer. Si cambia a
  // `false` antes, el cleanup cancela el timer.
  useEffect(() => {
    if (!activo) return
    const t = setTimeout(() => {
      dispatch({ tipo: 'mostrar' })
    }, delayMs)
    return () => clearTimeout(t)
  }, [activo, delayMs])

  return estado === 'mostrado'
}

export const IndicadorConexion = () => {
  const { estado } = useEstadoConexion()
  const activo = estado !== 'online'
  const visible = useDelayedTrue(activo, 600)

  if (estado === 'online' || !visible) return null

  const info = MENSAJES[estado]
  const Icono = estado === 'sin-internet' ? WifiOff : ServerCrash

  const reintentar = () => {
    // Forzamos un ping al backend actualizando la página actual.
    // Es la opción más segura: SWR revalidará todo en el siguiente render.
    window.location.reload()
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[100] bg-amber-50 border-b border-amber-300 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Icono size={20} className="text-amber-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 truncate">
            {info.texto}
          </p>
          <p className="text-xs text-amber-800 truncate">{info.detalle}</p>
        </div>
        <button
          type="button"
          onClick={reintentar}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-md hover:bg-amber-100 active:scale-95 transition cursor-pointer"
          aria-label="Reintentar conexión"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      </div>
    </div>
  )
}
