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

export const InicioSesionDesktop = ({ form, onSubmit, isMutating, apiError }: Props) => {
  const { register, formState: { errors } } = form
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-blue-100 flex max-w-4xl w-full overflow-hidden">
        
        {/* Left Side */}
        <div className="w-1/2 bg-gradient-to-br from-blue-400 to-blue-600 p-12 text-white flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-6">RACPD</h1>
          <p className="text-blue-50 text-lg leading-relaxed">
            Red de Apoyo para Cuidadores de Personas con Dependencia.
            Accede a tu panel para gestionar la atención y agenda de relevos.
          </p>
        </div>

        {/* Right Side */}
        <div className="w-1/2 p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-8">Iniciar Sesión</h2>
          
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
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
              className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                isMutating
                  ? 'bg-blue-400 cursor-not-allowed opacity-90'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md cursor-pointer active:scale-[0.98]'
              }`}
            >
              {isMutating && <Loader2 size={20} className="animate-spin" />}
              {isMutating ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
