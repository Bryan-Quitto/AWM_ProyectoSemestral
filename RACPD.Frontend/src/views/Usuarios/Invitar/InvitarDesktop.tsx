import type { InvitarProps } from './InvitarContenedor'

export const InvitarDesktop = ({ form, onSubmit, isMutating, apiError, exito }: InvitarProps) => {
  return (
    <div className="flex justify-center items-center h-full p-8 bg-blue-50/50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-sm border border-blue-100">
        <h1 className="text-2xl font-bold text-blue-900 mb-2">Invitar Usuario</h1>
        <p className="text-blue-600 mb-8">Invita a un nuevo Cuidador o Personal de Apoyo a la plataforma.</p>

        {apiError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {apiError}
          </div>
        )}
        
        {exito && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {exito}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="nombre" className="block text-sm font-medium text-blue-900">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                disabled={isMutating}
                className="w-full p-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="Ej. Juan"
                {...form.register('nombre')}
              />
              {form.formState.errors.nombre && (
                <p className="text-sm text-red-500">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="apellido" className="block text-sm font-medium text-blue-900">
                Apellido
              </label>
              <input
                id="apellido"
                type="text"
                disabled={isMutating}
                className="w-full p-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="Ej. Pérez"
                {...form.register('apellido')}
              />
              {form.formState.errors.apellido && (
                <p className="text-sm text-red-500">{form.formState.errors.apellido.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="correo" className="block text-sm font-medium text-blue-900">
              Correo Electrónico
            </label>
            <input
              id="correo"
              type="email"
              disabled={isMutating}
              className="w-full p-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
              placeholder="juan.perez@ejemplo.com"
              {...form.register('correo')}
            />
            {form.formState.errors.correo && (
              <p className="text-sm text-red-500">{form.formState.errors.correo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="rol" className="block text-sm font-medium text-blue-900">
              Rol
            </label>
            <select
              id="rol"
              disabled={isMutating}
              className="w-full p-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white disabled:opacity-50"
              {...form.register('rol', { valueAsNumber: true })}
            >
              <option value={1}>Cuidador Principal</option>
              <option value={2}>Apoyo</option>
              <option value={0}>Administrador del Sistema</option>
            </select>
            {form.formState.errors.rol && (
              <p className="text-sm text-red-500">{form.formState.errors.rol.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isMutating}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMutating ? 'Enviando invitación...' : 'Enviar Invitación'}
          </button>
        </form>
      </div>
    </div>
  )
}
