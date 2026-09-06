import { useEffect, useState } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { Home, User, CalendarDays, LogOut, UserPlus, Settings } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCerrarSesion } from './useCerrarSesion'
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../api/generated/api/api'
import { Boton } from '../../components/Boton'

type UsuarioSesion = {
  correo?: string
  rol?: string
}

export const LayoutPrincipalDesktop = () => {
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
      // El rol está en app_metadata.role del JWT. Lo extraemos del token.
      const token = session.access_token
      const payloadSegment = token.split('.')[1]
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
  // RBAC: solo CuidadorPrincipal y Apoyo gestionan la ficha del dependiente.
  // El guard en la ruta '/perfil-dependiente' refuerza esto a nivel de navegación,
  // pero ocultar el enlace evita fricción y clics inútiles.
  const puedeVerFichaDependiente =
    usuario?.rol === 'CuidadorPrincipal' || usuario?.rol === 'Apoyo'

  return (
    <div className="flex h-screen bg-blue-50">
      <aside className="w-64 bg-white border-r border-blue-200 flex flex-col">
        <div className="p-6 border-b border-blue-200">
          <h1 className="text-2xl font-bold text-blue-900">RACPD</h1>
          {perfilData?.data ? (
            <div className="mt-1">
              <p className="text-sm font-semibold text-blue-800 truncate" title={`${perfilData.data.nombre} ${perfilData.data.apellido}`}>
                {perfilData.data.nombre} {perfilData.data.apellido}
              </p>
              <p className="text-xs text-blue-500 truncate" title={usuario?.correo}>
                {usuario?.correo}
              </p>
            </div>
          ) : usuario?.correo ? (
            <p className="text-xs text-blue-600 mt-1 truncate" title={usuario.correo}>
              {usuario.correo}
            </p>
          ) : null}
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors"
          >
            <Home size={20} />
            <span>Inicio</span>
          </Link>
          {puedeVerFichaDependiente && (
            <Link
              to="/perfil-dependiente"
              className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors cursor-pointer"
            >
              <User size={20} />
              <span>Perfil del Dependiente</span>
            </Link>
          )}
          {!esAdmin && (
            <Link
              to="/agenda"
              className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors cursor-pointer"
            >
              <CalendarDays size={20} />
              <span>Agenda</span>
            </Link>
          )}
          {esAdmin && (
            <Link
              to="/usuarios/invitar"
              className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors"
            >
              <UserPlus size={20} />
              <span>Invitar Usuario</span>
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-blue-200 flex flex-col gap-3">
          <Link
            to="/configuracion"
            className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors"
          >
            <Settings size={20} />
            <span>Configuración</span>
          </Link>
          <Boton
            variante="secundario"
            onClick={cerrarSesion}
            cargando={cerrando}
            className="w-full py-3 rounded-lg gap-2"
          >
            <LogOut size={20} />
            {cerrando ? 'Cerrando...' : 'Cerrar Sesión'}
          </Boton>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
