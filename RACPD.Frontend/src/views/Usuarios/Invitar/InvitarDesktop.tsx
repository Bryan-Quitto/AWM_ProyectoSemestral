import type { InvitarProps } from './InvitarContenedor'
import { Controller } from 'react-hook-form'
import { SelectorDinamico } from '../../../components/SelectorDinamico'
import { Boton } from '../../../components/Boton'

const opcionesRol = [
  { valor: 1, etiqueta: 'Cuidador Principal' },
  { valor: 2, etiqueta: 'Apoyo' },
  { valor: 0, etiqueta: 'Administrador del Sistema' },
]

export const InvitarDesktop = ({ form, onSubmit, isMutating, apiError, exito }: InvitarProps) => {
  return (
    <div className="flex justify-center items-center h-full p-8 bg-blue-50/50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-sm border border-blue-100">
        <h1 className="text-2xl font-bold text-blue-900 mb-2">Invitar Usuario</h1>
        <p className="text-blue-600 mb-8">
          Invita a un nuevo Cuidador o Personal de Apoyo a la plataforma.
        </p>

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
            <Controller
              name="rol"
              control={form.control}
              render={({ field }) => (
                <SelectorDinamico
                  id="rol"
                  disabled={isMutating}
                  opciones={opcionesRol}
                  value={field.value}
                  onChange={field.onChange}
                  error={form.formState.errors.rol?.message}
                />
              )}
            />
            {form.formState.errors.rol && (
              <p className="text-sm text-red-500">{form.formState.errors.rol.message}</p>
            )}
          </div>

          <Boton
            type="submit"
            cargando={isMutating}
            className="w-full p-3 rounded-lg"
          >
            {isMutating ? 'Enviando invitación...' : 'Enviar Invitación'}
          </Boton>
        </form>
      </div>
    </div>
  )
}
