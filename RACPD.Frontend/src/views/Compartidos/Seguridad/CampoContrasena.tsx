/**
 * Componente `CampoContrasena`.
 *
 * Campo de entrada de contraseña con botón de alternar visibilidad
 * (mostrar/ocultar). Mantiene su propio estado de UI (`mostrar`) y
 * delega el valor controlado al componente padre mediante `onChange`.
 *
 * Características:
 * - Tipado estricto sin `any` ni operadores de aserción no nula (`!`).
 * - Accesibilidad: el botón expone `aria-label` adecuado al estado actual.
 * - Estilo coherente con la paleta azul/celeste de RACPD.
 */
import { useState, type ChangeEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Propiedades del componente `CampoContrasena`.
 */
type CampoContrasenaProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
};

/**
 * Componente controlado de entrada de contraseña con alternar visibilidad.
 */
export function CampoContrasena(props: CampoContrasenaProps) {
  const {
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    autoComplete,
    id,
    name,
    ariaLabel,
  } = props;

  const [mostrar, setMostrar] = useState<boolean>(false);

  /**
   * Manejador tipado del evento `change` del input. No requiere coerción
   * destructiva porque `e.target.value` ya es `string`.
   */
  const manejarCambio = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value);
  };

  const tipoInput: 'text' | 'password' = mostrar ? 'text' : 'password';
  const etiquetaAlternar: string = mostrar
    ? 'Ocultar contraseña'
    : 'Mostrar contraseña';

  return (
    <div className="relative">
      <input
        type={tipoInput}
        value={value}
        onChange={manejarCambio}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        id={id}
        name={name}
        aria-label={ariaLabel}
        className="w-full p-3 pr-12 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 bg-white"
      />

      <button
        type="button"
        onClick={() => setMostrar((estadoAnterior) => !estadoAnterior)}
        disabled={disabled}
        aria-label={etiquetaAlternar}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {mostrar ? (
          <EyeOff aria-hidden="true" size={20} />
        ) : (
          <Eye aria-hidden="true" size={20} />
        )}
      </button>

      {typeof error === 'string' && error.length > 0 ? (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      ) : null}
    </div>
  );
}