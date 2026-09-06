import { X, AlertTriangle } from 'lucide-react';
import { Boton } from '../../components/Boton';

interface ConfirmarAccionProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
  tipo?: 'peligro' | 'info';
}

export const ConfirmarAccion = ({
  abierto,
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
  cargando = false,
  tipo = 'info',
}: ConfirmarAccionProps) => {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancelar}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancelar}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${tipo === 'peligro' ? 'bg-red-100' : 'bg-blue-100'}`}>
            <AlertTriangle className={`w-6 h-6 ${tipo === 'peligro' ? 'text-red-600' : 'text-blue-600'}`} />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{titulo}</h3>
            <p className="text-gray-600">{mensaje}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Boton
            variante="secundario"
            onClick={onCancelar}
            className="flex-1 cursor-pointer"
            disabled={cargando}
          >
            Cancelar
          </Boton>
          <Boton
            onClick={onConfirmar}
            className={`flex-1 cursor-pointer ${
              tipo === 'peligro' 
                ? 'bg-red-600 hover:bg-red-700' 
                : ''
            }`}
            disabled={cargando}
            cargando={cargando}
          >
            {cargando ? 'Procesando...' : 'Confirmar'}
          </Boton>
        </div>
      </div>
    </div>
  );
};
