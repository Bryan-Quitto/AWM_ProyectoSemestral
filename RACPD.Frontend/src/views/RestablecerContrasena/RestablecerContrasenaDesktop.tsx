import { Link } from '@tanstack/react-router';
import type { UseFormReturn } from 'react-hook-form';
import type { RestablecerContrasenaValores } from './schema';
import { CampoContrasena } from '../../components/Seguridad/CampoContrasena';
import { IndicadorFortalezaContrasena } from '../../components/Seguridad/IndicadorFortalezaContrasena';

interface Props {
  form: UseFormReturn<RestablecerContrasenaValores>;
  onSubmit: (data: RestablecerContrasenaValores) => Promise<void>;
  estaMutando: boolean;
  errorApi: string | null;
  exito: string | null;
}

/**
 * Vista desktop (≥768px) de "Restablecer Contraseña".
 *
 * Replica el layout split-screen del Login desktop y reutiliza
 * `CampoContrasena` + `IndicadorFortalezaContrasena` siguiendo el
 * patrón canónico del proyecto (watch + setValue shouldValidate).
 */
export const RestablecerContrasenaDesktop = ({
  form,
  onSubmit,
  estaMutando,
  errorApi,
  exito
}: Props) => {
  const { formState: { errors }, handleSubmit, watch, setValue } = form;
  const nuevaContrasena = watch('nuevaContrasena') ?? '';
  const confirmarContrasena = watch('confirmarContrasena') ?? '';

  const manejarCambioNueva = (valor: string): void => {
    setValue('nuevaContrasena', valor, { shouldValidate: true });
  };

  const manejarCambioConfirmar = (valor: string): void => {
    setValue('confirmarContrasena', valor, { shouldValidate: true });
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-blue-100 flex max-w-4xl w-full overflow-hidden">

        <div className="w-1/2 bg-gradient-to-br from-blue-400 to-blue-600 p-12 text-white flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-6">RACPD</h1>
          <p className="text-blue-50 text-lg leading-relaxed">
            Define una nueva contraseña segura para tu cuenta. Asegúrate
            de que cumpla con la política de seguridad del sistema.
          </p>
        </div>

        <div className="w-1/2 p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">
            Restablecer contraseña
          </h2>
          <p className="text-sm text-blue-700 mb-8">
            Ingresa y confirma tu nueva contraseña.
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label
                  htmlFor="nueva-contrasena"
                  className="block text-sm font-medium text-blue-900 mb-2"
                >
                  Nueva contraseña
                </label>
                <CampoContrasena
                  id="nueva-contrasena"
                  name="nuevaContrasena"
                  value={nuevaContrasena}
                  onChange={manejarCambioNueva}
                  disabled={estaMutando}
                  autoComplete="new-password"
                  ariaLabel="Nueva contraseña"
                />
                <div className="mt-3">
                  <IndicadorFortalezaContrasena contrasena={nuevaContrasena} />
                </div>
                {errors.nuevaContrasena !== undefined && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.nuevaContrasena.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmar-contrasena"
                  className="block text-sm font-medium text-blue-900 mb-2"
                >
                  Confirmar contraseña
                </label>
                <CampoContrasena
                  id="confirmar-contrasena"
                  name="confirmarContrasena"
                  value={confirmarContrasena}
                  onChange={manejarCambioConfirmar}
                  disabled={estaMutando}
                  autoComplete="new-password"
                  ariaLabel="Confirmar contraseña"
                />
                {errors.confirmarContrasena !== undefined && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.confirmarContrasena.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={estaMutando}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
              >
                {estaMutando ? 'Actualizando…' : 'Actualizar contraseña'}
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
