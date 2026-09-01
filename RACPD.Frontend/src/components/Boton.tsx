import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'icono';
  cargando?: boolean;
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(
  ({ className, variante = 'primario', cargando, children, disabled, ...props }, ref) => {
    const clasesBase = 'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center transition-all font-medium';
    
    const variantes = {
      primario: 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-[0.98]',
      secundario: 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50 hover:shadow-sm active:scale-[0.98]',
      icono: 'bg-transparent text-gray-700 hover:bg-gray-100 hover:text-blue-600 p-2 rounded-full',
    };

    const clasesFinales = [
      clasesBase,
      variantes[variante],
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        disabled={disabled || cargando}
        className={clasesFinales}
        aria-busy={cargando}
        {...props}
      >
        {cargando && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);

Boton.displayName = 'Boton';
