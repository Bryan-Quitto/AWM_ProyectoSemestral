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
 * Vista desktop (≥768px) de "Recuperar Contraseña".
 *
 * Replica el layout split-screen del Login desktop para mantener
 * consistencia visual y de marca.
 */
export const RecuperarContrasenaDesktop = ({
  form,
  onSubmit,
  estaMutando,
  errorApi,
  exito
}: Props) => {
  const { register, formState: { errors } } = form;

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-blue-100 flex max-w-4xl w-full overflow-hidden">

        {/* Lado izquierdo: branding */}
        <div className="w-1/2 bg-gradient-to-br from-blue-400 to-blue-600 p-12 text-white flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-6">RACPD</h1>
          <p className="text-blue-50 text-lg leading-relaxed">
            Red de Apoyo para Cuidadores de Personas con Dependencia.
            Recupera el acceso a tu panel para gestionar la atención
            y la agenda de relevos.
          </p>
        </div>

        {/* Lado derecho: formulario */}
        <div className="w-1/2 p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Recuperar contraseña
          </h2>
          <p className="text-sm text-blue-700 mb-8">
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
                  htmlFor="correo-recuperar"
                  className="block text-sm font-medium text-blue-900 mb-2"
                >
                  Correo Electrónico
                </label>
                <input
                  id="correo-recuperar"
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
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
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
    </div>
  );
};
