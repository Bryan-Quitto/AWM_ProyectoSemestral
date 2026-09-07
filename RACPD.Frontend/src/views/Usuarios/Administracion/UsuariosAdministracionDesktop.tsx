import { Search, UserPlus, Users } from 'lucide-react'
import { Boton } from '../../../components/Boton'
import { TarjetaUsuario } from './TarjetaUsuario'
import type { RACPDBackendFeaturesUsuariosAdministracionUsuarioAdministracionResponse } from '../../../api/generated/model'

interface Props {
  usuarios: Array<{
    id?: string
    correo?: string
    nombre?: string
    apellido?: string
    rol?: string
    estado?: string
  }>
  isLoading: boolean
  busqueda: string
  onBuscar: (texto: string) => void
  totalUsuarios: number
  totalFiltrados: number
  isMutating: boolean
  idSesionActual?: string
  // TODO DEUDA TÉCNICA: prop onCambiarRol comentada. Reactivar junto con el
  // botón "Cambiar rol" en TarjetaUsuario cuando se defina el modelo de
  // transición de roles.
  // onCambiarRol: (id: string, nuevoRolNumero: number) => Promise<void>
  onCambiarEstado: (id: string, nuevoEstado: 'Activo' | 'Desactivado') => Promise<void>
  onInvitar: () => void
}

export const UsuariosAdministracionDesktop = ({
  usuarios,
  isLoading,
  busqueda,
  onBuscar,
  totalUsuarios,
  totalFiltrados,
  isMutating,
  idSesionActual,
  // onCambiarRol, // TODO DEUDA TÉCNICA: comentado hasta reactivar cambio de rol.
  onCambiarEstado,
  onInvitar
}: Props) => {
  return (
    <div className="max-w-6xl mx-auto p-8 bg-blue-50 min-h-screen">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Usuarios</h1>
          <p className="text-blue-700 mt-1">
            Gestiona las cuentas de la plataforma. Invita nuevos usuarios, activa/desactiva usuarios.
          </p>
        </div>
        <Boton
          type="button"
          onClick={onInvitar}
          className="py-3 px-5 rounded-xl"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Invitar Usuario
        </Boton>
      </div>

      <div className="flex items-center gap-3 mb-6 p-3 bg-white rounded-xl border border-blue-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar por nombre, apellido o correo…"
            className="w-full pl-10 pr-4 py-2 bg-blue-50/50 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>
        <span className="text-sm text-blue-600 whitespace-nowrap">
          {busqueda.trim().length > 0
            ? `${totalFiltrados} de ${totalUsuarios}`
            : `${totalUsuarios} usuario${totalUsuarios !== 1 ? 's' : ''}`}
        </span>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Cargando usuarios…</div>
      ) : usuarios.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-blue-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-blue-900 mb-2">
            {busqueda.trim().length > 0
              ? 'No se encontraron usuarios con ese criterio.'
              : 'Aún no hay usuarios registrados.'}
          </h3>
          {busqueda.trim().length === 0 && (
            <p className="text-gray-600 mb-4">
              Invita al primer cuidador o personal de apoyo desde el botón superior.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {usuarios.map((u) => (
            <TarjetaUsuario
              key={u.id ?? u.correo}
              usuario={u as RACPDBackendFeaturesUsuariosAdministracionUsuarioAdministracionResponse}
              esMiPropiaCuenta={!!u.id && u.id === idSesionActual}
              // TODO DEUDA TÉCNICA: onCambiarRol comentado hasta reactivar cambio de rol.
              // onCambiarRol={onCambiarRol}
              onCambiarEstado={onCambiarEstado}
              isMutating={isMutating}
            />
          ))}
        </div>
      )}
    </div>
  )
}
