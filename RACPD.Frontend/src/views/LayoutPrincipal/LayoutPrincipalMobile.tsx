import { useEffect, useState } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { Home, Users, CalendarDays, LogOut, AlertTriangle, Settings, UsersRound, Accessibility } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCerrarSesion } from './useCerrarSesion'
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../api/generated/api/api'
import { Boton } from '../../components/Boton'
import { CampanaNotificaciones } from './CampanaNotificaciones'
import { extraerRolDelToken, type Rol } from '../../autenticacion/roles'
import { usePreferenciasAccesibilidad } from '../../components/Accesibilidad/usePreferenciasAccesibilidad'

type UsuarioSesion = {
  id?: string
  correo?: string
  rol?: Rol | null
}

export const LayoutPrincipalMobile = () => {
  const { cerrarSesion, cerrando } = useCerrarSesion()
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [tecladoAbierto, setTecladoAbierto] = useState(false)

  // Acceso al panel de accesibilidad para activarlo desde el header móvil
  const { totalModificacionesActivas, panelAbierto, alternarPanel, preferencias } = usePreferenciasAccesibilidad()

  // Usamos SWR para obtener el nombre y apellido en caché
  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint()

  // Salvaguarda 3: Detección estricta de teclado virtual en inputs editables de texto
  useEffect(() => {
    const tiposTextoValidos = new Set([
      'text',
      'search',
      'tel',
      'email',
      'password',
      'number',
      'url',
    ])

    const esCampoTexto = (elemento: EventTarget | null): boolean => {
      if (!elemento || !(elemento instanceof HTMLElement)) return false
      if (elemento.tagName === 'TEXTAREA' || elemento.isContentEditable) {
        return true
      }
      if (elemento.tagName === 'INPUT') {
        const input = elemento as HTMLInputElement
        const tipo = (input.type || 'text').toLowerCase()
        return tiposTextoValidos.has(tipo)
      }
      return false
    }

    const manejarFocusIn = (e: FocusEvent) => {
      if (esCampoTexto(e.target)) {
        setTecladoAbierto(true)
      }
    }

    const manejarFocusOut = (e: FocusEvent) => {
      if (esCampoTexto(e.target)) {
        setTecladoAbierto(false)
      }
    }

    document.addEventListener('focusin', manejarFocusIn)
    document.addEventListener('focusout', manejarFocusOut)

    return () => {
      document.removeEventListener('focusin', manejarFocusIn)
      document.removeEventListener('focusout', manejarFocusOut)
    }
  }, [])

  useEffect(() => {
    const cargarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!user || !session) {
        setUsuario(null)
        return
      }
      // Decodificación segura del JWT vía helper tipado (cumple REGLA-TS-ESTRICTO
      // y elimina el bloque artesanal con `atob` + casting del payload).
      const rol = extraerRolDelToken(session.access_token)
      setUsuario({ id: user.id, correo: user.email, rol })
    }
    void cargarUsuario()
  }, [])

  const esAdmin = usuario?.rol === 'AdministradorSistema'
  // RBAC: el menú inferior solo muestra "Dependientes" a cuidadores y apoyo.
  const puedeVerFichaDependiente =
    usuario?.rol === 'CuidadorPrincipal' || usuario?.rol === 'Apoyo'

  return (
    <div className="flex flex-col min-h-dvh h-dvh bg-blue-50" style={{ minHeight: '100dvh' }}>
      {/* Header móvil adaptativo (Salvaguarda 2: min-w-0 flex-1 en columna izquierda y shrink-0 con gap compacto a la derecha) */}
      <header className="bg-white px-3.5 py-3 border-b border-blue-200 flex justify-between items-center shadow-xs shrink-0">
        <div className="min-w-0 flex-1 pr-2">
          <h1 className="text-xl font-bold text-blue-900 leading-tight">RACPD</h1>
          {perfilData?.data ? (
            <div className="mt-0.5">
              <p className="text-xs sm:text-sm font-semibold text-blue-800 truncate" title={`${perfilData.data.nombre} ${perfilData.data.apellido}`}>
                {perfilData.data.nombre} {perfilData.data.apellido}
              </p>
              {usuario?.correo && (
                <p className="text-[10px] text-blue-400 truncate leading-tight" title={usuario.correo}>
                  {usuario.correo}
                </p>
              )}
            </div>
          ) : usuario?.correo ? (
            <p className="text-[10px] text-blue-600 truncate leading-tight" title={usuario.correo}>
              {usuario.correo}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Disparador de Accesibilidad en Header Móvil (Controlable desde Configuración > Accesibilidad) */}
          {preferencias.botonFlotanteVisible && (
            <button
              type="button"
              data-accesibilidad-trigger
              onClick={alternarPanel}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors relative min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
              aria-label="Menú de accesibilidad"
              aria-expanded={panelAbierto}
              title="Accesibilidad"
            >
              <Accessibility size={20} />
              {totalModificacionesActivas > 0 && (
                <span 
                  className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border border-white shadow-xs"
                  aria-label={`${totalModificacionesActivas} ajustes de accesibilidad activos`}
                >
                  {totalModificacionesActivas}
                </span>
              )}
            </button>
          )}

          {/* La campana de notificaciones resume turnos del dependiente
              activo. Para el Administrador del Sistema no aporta contexto
              útil (no gestiona una agenda de cuidados), así que la
              ocultamos. Coherente con el menú inferior: Agenda y
              Directorio también se ocultan para admin. */}
          {!esAdmin && (
            <CampanaNotificaciones
              tamanoIcono={20}
              alineacionPopover="derecha"
            />
          )}
          <Boton
            variante="icono"
            onClick={cerrarSesion}
            cargando={cerrando}
            className="text-blue-600 hover:bg-blue-50 !min-h-[40px] !min-w-[40px]"
            title="Cerrar sesión"
          >
            {!cerrando && <LogOut size={20} />}
          </Boton>
          
          {/* DECISIÓN DE DISEÑO: El botón SOS es exclusivo de la vista móvil por su naturaleza de emergencia y acceso rápido en terreno. No es una inconsistencia con Desktop. */}
          <Link
            to="/sos"
            aria-label="Abrir modo de emergencia SOS"
            className="px-2.5 py-1 flex items-center justify-center gap-1 bg-red-50 text-red-700 rounded-lg font-bold border border-red-200 text-xs sm:text-sm touch-manipulation cursor-pointer hover:bg-red-100 active:scale-95 transition-transform min-h-[40px] min-w-[40px] select-none"
          >
            <AlertTriangle size={15} />
            SOS
          </Link>
        </div>
      </header>

      {/* Main en flujo flex: min-h-0 obligatorio para permitir scroll natural en flex-1 */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </main>

      {/* Nav en flujo normal (shrink-0) sin fixed frágil: desaparece limpiamente al escribir para no restar pantalla */}
      <nav className={`shrink-0 w-full bg-white border-t border-blue-200 flex justify-around items-center h-16 pb-safe z-30 transition-all duration-150 ${tecladoAbierto ? 'hidden' : ''}`}>
        <Link
          to="/"
          className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
        >
          <Home size={24} />
          <span className="text-[10px] mt-1 font-medium">Inicio</span>
        </Link>
        {puedeVerFichaDependiente && (
          <Link
            to="/dependientes"
            className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
          >
            <Users size={24} />
            <span className="text-[10px] mt-1 font-medium">Dependientes</span>
          </Link>
        )}
        {!esAdmin && (
          <Link
            to="/agenda"
            className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
          >
            <CalendarDays size={24} />
            <span className="text-[10px] mt-1 font-medium">Agenda</span>
          </Link>
        )}
        {!esAdmin && (
          <Link
            to="/directorio-relevos"
            className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
          >
            <UsersRound size={24} />
            <span className="text-[10px] mt-1 font-medium">Directorio</span>
          </Link>
        )}
        {esAdmin && (
          <Link
            to="/usuarios"
            className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
          >
            <Users size={24} />
            <span className="text-[10px] mt-1 font-medium">Usuarios</span>
          </Link>
        )}
        <Link
          to="/configuracion"
          className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
        >
          <Settings size={24} />
          <span className="text-[10px] mt-1 font-medium">Config.</span>
        </Link>
      </nav>
    </div>
  )
}
