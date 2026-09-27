import { AlertTriangle, X } from 'lucide-react';
import { Boton } from '../../components/Boton';

interface DialogoConfirmarEliminarProps {
  abierto: boolean;
  /** Nombre del relevo, para personalizar el mensaje. */
  nombreRelevo: string;
  /** Llamado al confirmar. La acción de red la hace el padre. */
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Mientras la mutación está en curso. */
  isMutating: boolean;
  /** Mensaje de error devuelto por el backend (RFC 7807 detail). */
  apiError?: string | null;
}

/**
 * Diálogo de confirmación para eliminar (soft-delete) un relevo.
 *
 * UX crítico en salud: una eliminación accidental dejaría a un
 * dependiente sin esa persona de apoyo en su directorio. Por eso
 * exigimos un paso explícito de confirmación con el nombre del relevo
 * visible, no un confirm nativo del navegador.
 *
 * UI ligada a dominio (se queda en /views, no en /components, por la
 * REGLA-AHA-UI).
 *
 * Cumple REGLA-UX-INTERACCIONES: cursor-pointer en todos los botones
 * y `disabled:cursor-not-allowed disabled:opacity-50` en los
 * bloqueados.
 */
export const DialogoConfirmarEliminar = ({
  abierto,
  nombreRelevo,
  onConfirmar,
  onCancelar,
  isMutating,
  apiError,
}: DialogoConfirmarEliminarProps) => {
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-eliminar-titulo"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isMutating ? undefined : onCancelar}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancelar}
          aria-label="Cerrar"
          disabled={isMutating}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3
              id="dialogo-eliminar-titulo"
              className="text-lg font-semibold text-gray-900"
            >
              Eliminar relevo
            </h3>
            <p className="text-sm text-gray-600">
              Vas a eliminar a <strong>{nombreRelevo}</strong> del directorio
              de tu dependiente. Esta acción se puede revertir creando un
              nuevo relevo para el mismo usuario.
            </p>
          </div>
        </div>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Boton
            variante="secundario"
            onClick={onCancelar}
            className="flex-1 cursor-pointer disabled:cursor-not-allowed"
            disabled={isMutating}
          >
            Cancelar
          </Boton>
          <Boton
            onClick={onConfirmar}
            className="flex-1 cursor-pointer disabled:cursor-not-allowed !bg-red-600 hover:!bg-red-700 !text-white"
            disabled={isMutating}
            cargando={isMutating}
          >
            {isMutating ? 'Eliminando...' : 'Sí, eliminar'}
          </Boton>
        </div>
      </div>
    </div>
  );
};
