import { useEffect, useState } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { Home, User, CalendarDays, LogOut, AlertTriangle, UserPlus, Settings } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCerrarSesion } from './useCerrarSesion'
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../api/generated/api/api'
import { Boton } from '../../components/Boton'

type UsuarioSesion = {
  correo?: string
  rol?: string
}

export const LayoutPrincipalMobile = () => {
  const { cerrarSesion, cerrando } = useCerrarSesion()
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)

  // Usamos SWR para obtener el nombre y apellido en caché
  const { data: perfilData } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint()

  useEffect(() => {
    const cargarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!user || !session) {
        setUsuario(null)
        return
      }
      const payloadSegment = session.access_token.split('.')[1]
      let rol: string | undefined
      try {
        const json = atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/'))
        const payload = JSON.parse(json) as { app_metadata?: { role?: string } }
        rol = payload.app_metadata?.role
      } catch {
        rol = undefined
      }
      setUsuario({ correo: user.email, rol })
    }
    void cargarUsuario()
  }, [])

  const esAdmin = usuario?.rol === 'AdministradorSistema'

  return (
    <div className="flex flex-col h-screen bg-blue-50">
      <header className="bg-white p-4 border-b border-blue-200 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-blue-900">RACPD</h1>
          {perfilData?.data ? (
            <div className="mt-0.5">
              <p className="text-sm font-semibold text-blue-800 truncate max-w-[180px]" title={`${perfilData.data.nombre} ${perfilData.data.apellido}`}>
                {perfilData.data.nombre} {perfilData.data.apellido}
              </p>
            </div>
          ) : usuario?.correo ? (
            <p className="text-[10px] text-blue-600 truncate max-w-[180px]" title={usuario.correo}>
              {usuario.correo}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/configuracion"
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors cursor-pointer active:scale-95"
            title="Configuración"
          >
            <Settings size={20} />
          </Link>
          <Boton
            variante="icono"
            onClick={cerrarSesion}
            cargando={cerrando}
            className="text-blue-600 hover:bg-blue-50"
            title="Cerrar sesión"
          >
            {!cerrando && <LogOut size={20} />}
          </Boton>
          
          {/* DECISIÓN DE DISEÑO: El botón SOS es exclusivo de la vista móvil por su naturaleza de emergencia y acceso rápido en terreno. No es una inconsistencia con Desktop. */}
          <div className="px-3 py-1 flex items-center gap-1 bg-red-50 text-red-700 rounded-lg font-bold border border-red-200 text-sm cursor-pointer hover:bg-red-100 active:bg-red-200 transition-colors select-none">
            <AlertTriangle size={16} />
            SOS
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 w-full bg-white border-t border-blue-200 flex justify-around items-center h-16 pb-safe z-50">
        <Link
          to="/"
          className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
        >
          <Home size={24} />
          <span className="text-[10px] mt-1 font-medium">Inicio</span>
        </Link>
        <Link
          to="/ficha-paciente"
          className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
        >
          <User size={24} />
          <span className="text-[10px] mt-1 font-medium">Ficha</span>
        </Link>
        <Link
          to="/agenda"
          className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
        >
          <CalendarDays size={24} />
          <span className="text-[10px] mt-1 font-medium">Agenda</span>
        </Link>
        {esAdmin && (
          <Link
            to="/usuarios/invitar"
            className="flex flex-col items-center justify-center w-full h-full text-blue-400 [&.active]:text-blue-900 cursor-pointer active:scale-95 transition-transform"
          >
            <UserPlus size={24} />
            <span className="text-[10px] mt-1 font-medium">Invitar</span>
          </Link>
        )}
      </nav>
    </div>
  )
}
