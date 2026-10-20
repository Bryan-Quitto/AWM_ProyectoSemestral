import { createRoot } from 'react-dom/client'
import { NotificacionesMobile } from '../../src/views/Configuracion/NotificacionesMobile'
import { NotificacionesDesktop } from '../../src/views/Configuracion/NotificacionesDesktop'
import './estilos.css'

const escenario = new URLSearchParams(location.search).get('escenario') ?? 'normal'
localStorage.removeItem('racpd:push:dispositivo')
let suscripcion: object | null = null
let permiso = escenario === 'bloqueado' ? 'denied' : 'default'
Object.defineProperty(window, 'Notification', { configurable: true, value: { get permission() { return permiso }, requestPermission: async () => { permiso = 'granted'; return permiso } } })
Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => ({ active: true, pushManager: {
  getSubscription: async () => suscripcion,
  subscribe: async () => { suscripcion = { endpoint: 'https://fcm.googleapis.com/pruebas/interfaz', getKey: (nombre: string) => new Uint8Array(nombre === 'auth' ? 16 : 65).buffer, unsubscribe: async () => { suscripcion = null; return true } }; return suscripcion },
} }) } })
if (escenario === 'sin-soporte') Reflect.deleteProperty(window, 'PushManager')
const elemento = document.getElementById('root')
if (!elemento) throw new Error('Falta contenedor de prueba')
createRoot(elemento).render(<main className="mx-auto max-w-5xl p-6 space-y-6">
  <h1 className="text-2xl font-semibold text-blue-900">Pruebas locales de notificaciones</h1>
  <p>Servicios, permisos y suscripciones simulados. No envía notificaciones reales.</p>
  <nav className="flex flex-wrap gap-4" aria-label="Escenarios de prueba">
    <a className="cursor-pointer underline text-blue-700" href="/?escenario=normal">Activación y baja</a>
    <a className="cursor-pointer underline text-blue-700" href="/?escenario=bloqueado">Permiso bloqueado</a>
    <a className="cursor-pointer underline text-blue-700" href="/?escenario=error">Error del servidor</a>
    <a className="cursor-pointer underline text-blue-700" href="/?escenario=sin-soporte">Sin compatibilidad</a>
  </nav>
  <div className="grid gap-6 md:grid-cols-2"><div><h2 className="mb-3 font-semibold">Vista móvil</h2><NotificacionesMobile /></div><div><h2 className="mb-3 font-semibold">Vista escritorio</h2><NotificacionesDesktop /></div></div>
</main>)
