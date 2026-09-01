import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { iniciarSesionSchema } from './schema'

interface Props {
  form: UseFormReturn<z.infer<typeof iniciarSesionSchema>>
  onSubmit: (data: z.infer<typeof iniciarSesionSchema>) => void
  isMutating: boolean
  apiError: string | null
}

export const InicioSesionMobile = ({ form, onSubmit, isMutating, apiError }: Props) => {
  const { register, formState: { errors } } = form
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">RACPD</h1>
          <p className="text-blue-400 text-sm">
            Red de Apoyo para Cuidadores
          </p>
        </div>

        <h2 className="text-2xl font-bold text-blue-900 mb-6">Iniciar Sesión</h2>
        
        {apiError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
            {apiError}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              {...register('correo')}
              className="w-full px-4 py-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/50 transition-colors"
              placeholder="ejemplo@correo.com"
              autoCapitalize="none"
              disabled={isMutating}
            />
            {errors.correo && (
              <p className="mt-2 text-sm text-red-600">{errors.correo.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                {...register('contrasena')}
                className="w-full px-4 py-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/50 transition-colors pr-12"
                placeholder="••••••••"
                disabled={isMutating}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.contrasena && (
              <p className="mt-2 text-sm text-red-600">{errors.contrasena.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isMutating}
            className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-semibold transition-all mt-4 ${
              isMutating
                ? 'bg-blue-400 cursor-not-allowed opacity-90'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer active:scale-[0.98]'
            }`}
          >
            {isMutating && <Loader2 size={20} className="animate-spin" />}
            {isMutating ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
