import type { InvitarProps } from './InvitarContenedor'

export const InvitarMobile = ({ form, onSubmit, isMutating, apiError, exito }: InvitarProps) => {
  return (
    <div className="min-h-screen bg-blue-50/30 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
        <h1 className="text-xl font-bold text-blue-900 mb-1">Invitar Usuario</h1>
        <p className="text-sm text-blue-600 mb-6">Añade un Cuidador o Personal de Apoyo</p>

        {apiError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {apiError}
          </div>
        )}
        
        {exito && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {exito}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="nombre" className="block text-sm font-medium text-blue-900">
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              disabled={isMutating}
              className="w-full p-3 bg-gray-50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
              placeholder="Juan"
              {...form.register('nombre')}
            />
            {form.formState.errors.nombre && (
              <p className="text-xs text-red-500">{form.formState.errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="apellido" className="block text-sm font-medium text-blue-900">
              Apellido
            </label>
            <input
              id="apellido"
              type="text"
              disabled={isMutating}
              className="w-full p-3 bg-gray-50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
              placeholder="Pérez"
              {...form.register('apellido')}
            />
            {form.formState.errors.apellido && (
              <p className="text-xs text-red-500">{form.formState.errors.apellido.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="correo" className="block text-sm font-medium text-blue-900">
              Correo Electrónico
            </label>
            <input
              id="correo"
              type="email"
              disabled={isMutating}
              className="w-full p-3 bg-gray-50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
              placeholder="juan@ejemplo.com"
              {...form.register('correo')}
            />
            {form.formState.errors.correo && (
              <p className="text-xs text-red-500">{form.formState.errors.correo.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rol" className="block text-sm font-medium text-blue-900">
              Rol
            </label>
            <select
              id="rol"
              disabled={isMutating}
              className="w-full p-3 bg-gray-50 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
              {...form.register('rol', { valueAsNumber: true })}
            >
              <option value={1}>Cuidador Principal</option>
              <option value={2}>Apoyo</option>
              <option value={0}>Administrador</option>
            </select>
            {form.formState.errors.rol && (
              <p className="text-xs text-red-500">{form.formState.errors.rol.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isMutating}
            className="w-full mt-2 bg-blue-600 text-white p-3.5 rounded-xl font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 shadow-sm"
          >
            {isMutating ? 'Procesando...' : 'Invitar'}
          </button>
        </form>
      </div>
    </div>
  )
}
