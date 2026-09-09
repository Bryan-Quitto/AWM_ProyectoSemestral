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
 * Vista mobile (<768px) de "Restablecer Contraseña".
 *
 * Replica el layout vertical del Login mobile y reutiliza
 * `CampoContrasena` + `IndicadorFortalezaContrasena`.
 */
export const RestablecerContrasenaMobile = ({
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
    <div className="min-h-screen bg-white flex flex-col p-6">
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">RACPD</h1>
          <p className="text-blue-400 text-sm">Red de Apoyo para Cuidadores</p>
        </div>

        <h2 className="text-2xl font-bold text-blue-900 mb-4">
          Restablecer contraseña
        </h2>
        <p className="text-sm text-blue-700 mb-6">
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
                htmlFor="nueva-contrasena-mobile"
                className="block text-sm font-medium text-blue-900 mb-2"
              >
                Nueva contraseña
              </label>
              <CampoContrasena
                id="nueva-contrasena-mobile"
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
                htmlFor="confirmar-contrasena-mobile"
                className="block text-sm font-medium text-blue-900 mb-2"
              >
                Confirmar contraseña
              </label>
              <CampoContrasena
                id="confirmar-contrasena-mobile"
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
              className="w-full py-3 rounded-lg mt-4 bg-blue-600 text-white font-medium hover:bg-blue-700 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center"
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
  );
};
