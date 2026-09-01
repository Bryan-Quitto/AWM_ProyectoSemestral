import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { Home, User, CalendarDays, LogOut, AlertTriangle, UserPlus } from 'lucide-react'

export const LayoutPrincipalDesktop = () => {
  const navigate = useNavigate()

  const handleCerrarSesion = () => {
    localStorage.removeItem('token')
    navigate({ to: '/inicio-sesion' })
  }

  return (
    <div className="flex h-screen bg-blue-50">
      <aside className="w-64 bg-white border-r border-blue-200 flex flex-col">
        <div className="p-6 border-b border-blue-200">
          <h1 className="text-2xl font-bold text-blue-900">RACPD</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors">
            <Home size={20} />
            <span>Inicio</span>
          </Link>
          <Link to="/ficha-paciente" className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors">
            <User size={20} />
            <span>Ficha de Paciente</span>
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors">
            <CalendarDays size={20} />
            <span>Agenda</span>
          </Link>
          {localStorage.getItem('rol') === 'AdministradorSistema' && (
            <Link to="/usuarios/invitar" className="flex items-center gap-3 px-4 py-3 text-blue-900 hover:bg-blue-50 rounded-lg [&.active]:bg-blue-100 [&.active]:font-semibold transition-colors">
              <UserPlus size={20} />
              <span>Invitar Cuidador</span>
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-blue-200 flex flex-col gap-3">
          <div className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-700 text-center rounded-lg font-bold border border-red-200 cursor-pointer hover:bg-red-100 transition-colors select-none active:scale-[0.98]">
            <AlertTriangle size={20} />
            SOS
          </div>
          <button 
            onClick={handleCerrarSesion}
            className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold transition-colors cursor-pointer active:scale-[0.98]"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
