import type { CompletarPerfilProps } from './CompletarPerfilContenedor'
import { CampoContrasena } from '../../../components/Seguridad/CampoContrasena'
import { IndicadorFortalezaContrasena } from '../../../components/Seguridad/IndicadorFortalezaContrasena'

export const CompletarPerfilMobile = ({
  form,
  onSubmit,
  isMutating,
  apiError,
  rolTextoLegible
}: CompletarPerfilProps) => {
  return (
    <div className="min-h-screen bg-blue-50/30 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
        <h1 className="text-xl font-bold text-blue-900 mb-1">Completa tu perfil</h1>
        <p className="text-sm text-blue-600 mb-6">Necesitamos unos datos para empezar.</p>

        {apiError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {apiError}
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
            <label htmlFor="rol" className="block text-sm font-medium text-blue-900">
              Rol
            </label>
            <input
              id="rol"
              type="text"
              value={rolTextoLegible}
              disabled
              className="w-full p-3 bg-gray-50 border border-blue-100 rounded-xl text-blue-900 cursor-not-allowed"
            />
            <p className="text-xs text-blue-600 mt-1">Asignado por el administrador, no puede modificarse.</p>
          </div>

          <div className="space-y-1.5">
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
              <p className="text-xs text-red-500">{form.formState.errors.contrasena.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
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
            className="w-full mt-2 bg-blue-600 text-white p-3.5 rounded-xl font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isMutating ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
