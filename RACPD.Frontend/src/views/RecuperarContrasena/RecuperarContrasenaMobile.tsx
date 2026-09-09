import type { UseFormReturn } from 'react-hook-form';
import { Link } from '@tanstack/react-router';
import type { RecuperarContrasenaValores } from './schema';

interface Props {
  form: UseFormReturn<RecuperarContrasenaValores>;
  onSubmit: (data: RecuperarContrasenaValores) => void;
  estaMutando: boolean;
  errorApi: string | null;
  exito: string | null;
}

/**
 * Vista mobile (<768px) de "Recuperar Contraseña".
 *
 * Replica el layout vertical del Login mobile para mantener
 * consistencia visual.
 */
export const RecuperarContrasenaMobile = ({
  form,
  onSubmit,
  estaMutando,
  errorApi,
  exito
}: Props) => {
  const { register, formState: { errors } } = form;

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">RACPD</h1>
          <p className="text-blue-400 text-sm">Red de Apoyo para Cuidadores</p>
        </div>

        <h2 className="text-2xl font-bold text-blue-900 mb-4">
          Recuperar contraseña
        </h2>
        <p className="text-sm text-blue-700 mb-6">
          Te enviaremos un enlace para que puedas restablecer tu contraseña.
        </p>

        {errorApi !== null && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
            {errorApi}
          </div>
        )}

        {exito !== null ? (
          <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
            {exito}
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label
                htmlFor="correo-recuperar-mobile"
                className="block text-sm font-medium text-blue-900 mb-2"
              >
                Correo Electrónico
              </label>
              <input
                id="correo-recuperar-mobile"
                type="email"
                {...register('correo')}
                autoCapitalize="none"
                autoComplete="email"
                placeholder="ejemplo@correo.com"
                disabled={estaMutando}
                className="w-full px-4 py-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.correo !== undefined && (
                <p className="mt-2 text-sm text-red-600">{errors.correo.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={estaMutando}
              className="w-full py-3 rounded-lg mt-4 bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
            >
              {estaMutando ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/inicio-sesion"
            className="text-sm text-blue-600 hover:underline cursor-pointer"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};
