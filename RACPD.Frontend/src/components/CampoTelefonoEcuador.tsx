import {
  forwardRef,
  type ChangeEvent,
  type ClipboardEvent,
  type InputHTMLAttributes,
} from 'react';
import { normalizarTelefonoEcuador, PREFIJO_ECUADOR } from '../schemas/telefono';

/**
 * Props del componente `CampoTelefonoEcuador`.
 *
 * Hereda todas las props nativas de un `<input type="tel">` (excepto `type`,
 * `onChange`, `onPaste` y `value` que están controladas por este componente),
 * para integrarse sin fricción con `react-hook-form` y con cualquier sistema
 * de estilos basado en clases utilitarias.
 */
export interface CampoTelefonoEcuadorProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'onPaste' | 'value' | 'defaultValue'> {
  /** Valor controlado: solo el cuerpo del número (sin el prefijo). */
  value: string;
  /** Callback que recibe el cuerpo del número (9 dígitos, sin prefijo). */
  onChange: (valor: string) => void;
  /** Mensaje de error a mostrar debajo del input (ya validado por Zod). */
  error?: string;
  /** Texto de ayuda opcional bajo el input cuando no hay error. */
  ayuda?: string;
  /** Etiqueta visible del campo. Si se omite, no se renderiza. */
  etiqueta?: string;
  /** Tamaño visual del input. `md` por defecto. */
  tamano?: 'sm' | 'md' | 'lg';
  /** Variante visual del contenedor del prefijo. */
  variante?: 'desktop' | 'mobile';
}

/**
 * Estilos por tamaño para mantener consistencia con el resto del design system.
 */
const TAMANO_CLASES: Record<NonNullable<CampoTelefonoEcuadorProps['tamano']>, string> = {
  sm: 'px-2 py-1.5 text-sm rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
  lg: 'px-3 py-2.5 text-base rounded-xl',
};

const PREFIJO_CLASES: Record<NonNullable<CampoTelefonoEcuadorProps['tamano']>, string> = {
  sm: 'px-2 py-1.5 text-sm rounded-l-md',
  md: 'px-3 py-2 text-sm rounded-l-lg',
  lg: 'px-3 py-2.5 text-base rounded-l-xl',
};

/**
 * Campo de texto agnóstico para números telefónicos de Ecuador.
 *
 * - Muestra el prefijo `+593` fijo (no editable) como un addon a la izquierda.
 * - Acepta únicamente dígitos en la entrada (cuerpo del número, 9 dígitos).
 * - En `onPaste` aplica `normalizarTelefonoEcuador` para limpiar formatos
 *   comunes: `+593...`, `0932...`, `593...`, números con espacios/guiones.
 * - Renderiza mensaje de error accesible (`aria-invalid` + `aria-describedby`).
 *
 * El componente es **100% agnóstico al dominio**: no conoce RACPD, ni
 * "contactos de emergencia", ni nada específico de una feature. Vive en
 * `src/components/` por regla de arquitectura del proyecto.
 *
 * @example
 *   <CampoTelefonoEcuador
 *     etiqueta="Teléfono WhatsApp"
 *     value={campo.value}
 *     onChange={campo.onChange}
 *     error={errores?.telefonoWhatsApp?.message}
 *   />
 */
export const CampoTelefonoEcuador = forwardRef<HTMLInputElement, CampoTelefonoEcuadorProps>(
  function CampoTelefonoEcuador(
    {
      value,
      onChange,
      error,
      ayuda,
      etiqueta,
      tamano = 'md',
      variante = 'desktop',
      disabled,
      className,
      id,
      ...rest
    },
    ref,
  ) {
    const inputId = id ?? 'campo-telefono-ecuador';
    const errorId = `${inputId}-error`;
    const ayudaId = `${inputId}-ayuda`;
    const tieneError = Boolean(error);

    /**
     * Maneja el cambio controlado del cuerpo del número.
     * Solo permite dígitos y limita a 9 caracteres.
     */
    const handleChange = (evento: ChangeEvent<HTMLInputElement>) => {
      const siguienteCuerpo = evento.target.value
        .replace(/\D/g, '')
        .slice(0, 9);
      onChange(siguienteCuerpo);
    };

    /**
     * Maneja el pegado: normaliza cualquier formato aceptado por la función
     * pura `normalizarTelefonoEcuador`, luego separa el prefijo del cuerpo
     * y notifica solo el cuerpo al caller.
     */
    const handlePaste = (evento: ClipboardEvent<HTMLInputElement>) => {
      evento.preventDefault();
      const textoPegado = evento.clipboardData.getData('text');
      const normalizado = normalizarTelefonoEcuador(textoPegado);
      const cuerpo = normalizado.startsWith(PREFIJO_ECUADOR)
        ? normalizado.slice(PREFIJO_ECUADOR.length)
        : normalizado;
      onChange(cuerpo.slice(0, 9));
    };

    return (
      <div className="w-full">
        {etiqueta && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {etiqueta}
          </label>
        )}
        <div
          className={[
            'flex w-full items-stretch overflow-hidden',
            'border focus-within:ring-2 focus-within:border-sky-500',
            'transition outline-none',
            tieneError
              ? 'border-red-400 focus-within:ring-red-300'
              : 'border-gray-300 focus-within:ring-sky-300',
            disabled ? 'bg-blue-50 opacity-60' : 'bg-white',
            className ?? '',
          ].join(' ')}
        >
          <span
            className={[
              'inline-flex items-center justify-center',
              'bg-blue-50 text-blue-800 font-semibold tracking-wide',
              'border-r border-blue-200 select-none',
              PREFIJO_CLASES[tamano],
            ].join(' ')}
            aria-hidden="true"
          >
            {PREFIJO_ECUADOR}
          </span>
          <input
            {...rest}
            ref={ref}
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            disabled={disabled}
            value={value}
            onChange={handleChange}
            onPaste={handlePaste}
            placeholder="9XXXXXXXX"
            aria-invalid={tieneError}
            aria-describedby={
              tieneError ? errorId : ayuda ? ayudaId : undefined
            }
            className={[
              'flex-1 min-w-0 border-0 outline-none bg-transparent',
              'cursor-pointer disabled:cursor-not-allowed',
              'text-gray-900 placeholder:text-gray-400',
              TAMANO_CLASES[tamano],
            ].join(' ')}
          />
        </div>
        {tieneError ? (
          <p id={errorId} className="text-red-500 text-xs mt-1" role="alert">
            {error}
          </p>
        ) : (
          ayuda && (
            <p id={ayudaId} className="text-gray-500 text-xs mt-1">
              {ayuda}
            </p>
          )
        )}
        {/* `variante` queda reservada para evolucionar a estilos distintos
            entre escritorio y móvil sin romper la firma del componente. */}
        {variante && <span hidden data-variant={variante} />}
      </div>
    );
  },
);
