import type { CompletarPerfilProps } from './CompletarPerfilContenedor'
import { CampoContrasena, IndicadorFortalezaContrasena } from '../../../views/Compartidos/Seguridad'

export const CompletarPerfilDesktop = ({
  form,
  onSubmit,
  isMutating,
  apiError,
  rolTextoLegible
}: CompletarPerfilProps) => {
  return (
    <div className="flex justify-center items-center min-h-screen p-8 bg-blue-50/50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-sm border border-blue-100">
        <h1 className="text-2xl font-bold text-blue-900 mb-2">Completa tu perfil</h1>
        <p className="text-blue-600 mb-8">Necesitamos unos datos para que puedas empezar a usar la plataforma.</p>

        {apiError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {apiError}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

          <div className="space-y-2">
            <label htmlFor="rol" className="block text-sm font-medium text-blue-900">
              Rol
            </label>
            <input
              id="rol"
              type="text"
              value={rolTextoLegible}
              disabled
              className="w-full p-3 border border-blue-200 rounded-lg bg-gray-50 text-blue-900 cursor-not-allowed"
            />
            <p className="text-xs text-blue-600 mt-1">Este rol fue asignado por el administrador y no puede modificarse, si no es el rol que esperaba, solicite a administración que le vuelvan a enviar la invitación.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="contrasena" className="block text-sm font-medium text-blue-900">
              Contraseña
            </label>
            <CampoContrasena
              id="contrasena"
              name="contrasena"
              value={form.watch('contrasena')}
              onChange={(v) => form.setValue('contrasena', v, { shouldValidate: true })}
              error={form.formState.errors.contrasena?.message}
              disabled={isMutating}
              autoComplete="new-password"
            />
            <IndicadorFortalezaContrasena contrasena={form.watch('contrasena')} />
            {form.formState.errors.contrasena && (
              <p className="text-sm text-red-500">{form.formState.errors.contrasena.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmarContrasena" className="block text-sm font-medium text-blue-900">
              Confirmar contraseña
            </label>
            <CampoContrasena
              id="confirmarContrasena"
              name="confirmarContrasena"
              value={form.watch('confirmarContrasena')}
              onChange={(v) => form.setValue('confirmarContrasena', v, { shouldValidate: true })}
              error={form.formState.errors.confirmarContrasena?.message}
              disabled={isMutating}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={isMutating}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMutating ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
