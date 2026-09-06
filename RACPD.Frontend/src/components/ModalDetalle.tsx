import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalDetalleProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  /** Icono opcional a la izquierda del título (ej. un <AlertTriangle/>). */
  icono?: ReactNode;
  children: ReactNode;
}

/**
 * ModalDetalle: modal reutilizable con overlay oscuro, cierre por backdrop o Escape,
 * accesible (role/aria-modal) y estilizado con la paleta azul/celeste del proyecto.
 *
 * No implementa focus trap completo (sería sobre-ingeniería para el MVP actual).
 * Lo crítico para el cuidador —lectura rápida en terreno— es Escape y backdrop.
 */
export const ModalDetalle = ({
  abierto,
  onCerrar,
  titulo,
  icono,
  children,
}: ModalDetalleProps) => {
  // Cierra con Escape
  useEffect(() => {
    if (!abierto) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [abierto, onCerrar]);

  // Evita scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fade-in_150ms_ease-out]"
      onClick={onCerrar}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto border border-blue-100"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-blue-50 px-5 py-4 border-b border-blue-100 flex items-center justify-between gap-2">
          <h3 className="font-bold text-blue-900 flex items-center gap-2 text-base">
            {icono}
            <span>{titulo}</span>
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="cursor-pointer p-1.5 rounded-full text-blue-700 hover:bg-blue-100 hover:text-blue-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5 text-sm text-gray-800 whitespace-pre-wrap break-words">
          {children}
        </div>
      </div>
    </div>
  );
};

ModalDetalle.displayName = 'ModalDetalle';