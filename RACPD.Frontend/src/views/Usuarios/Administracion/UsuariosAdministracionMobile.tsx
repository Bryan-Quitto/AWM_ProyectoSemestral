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

export const UsuariosAdministracionMobile = ({
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
    <div className="min-h-screen bg-blue-50/30 p-4 pb-20">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Usuarios</h1>
          <p className="text-sm text-blue-600">
            Gestiona roles y activa/desactiva cuentas.
          </p>
        </div>
        <Boton
          type="button"
          onClick={onInvitar}
          className="py-2 px-3 rounded-xl text-sm"
        >
          <UserPlus className="w-4 h-4 mr-1.5" /> Invitar
        </Boton>
      </div>

      <div className="bg-white rounded-xl border border-blue-100 p-1.5 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-10 pr-3 py-2 bg-blue-50/50 border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm"
          />
        </div>
      </div>

      <div className="text-xs text-blue-600 mb-3">
        {busqueda.trim().length > 0
          ? `${totalFiltrados} de ${totalUsuarios}`
          : `${totalUsuarios} usuario${totalUsuarios !== 1 ? 's' : ''}`}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Cargando…</div>
      ) : usuarios.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-blue-200 rounded-2xl p-8 text-center">
          <Users className="w-10 h-10 text-blue-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-blue-900 mb-1">
            {busqueda.trim().length > 0
              ? 'Sin resultados para tu búsqueda.'
              : 'Aún no hay usuarios.'}
          </h3>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
