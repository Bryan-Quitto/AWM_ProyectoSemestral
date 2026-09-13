import { useState } from 'react';
import { Search, UsersRound } from 'lucide-react';
import {
  useDirectorioRelevos,
  type RelevoItemResponse,
} from '../../features/directorio-relevos/hooks/useDirectorioRelevos';
import { TarjetaCuidador } from './TarjetaCuidador';

type FiltroEstado = 'Todos' | 'Disponible' | 'NoDisponible';

const FILTROS: { id: FiltroEstado; label: string }[] = [
  { id: 'Todos', label: 'Todos' },
  { id: 'Disponible', label: 'Disponibles' },
  { id: 'NoDisponible', label: 'No disp.' },
];

/**
 * Vista Mobile del Directorio de Relevos.
 *
 * Header sticky con buscador y pills compactas; lista vertical debajo.
 * Sin FAB (vista de solo lectura en Semana 1).
 */
export const DirectorioRelevosMobile = () => {
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('Todos');

  const estadoQuery = filtroEstado === 'Todos' ? undefined : filtroEstado;
  const terminoNormalizado = terminoBusqueda.trim();

  const { relevos, isLoading } = useDirectorioRelevos({
    terminoBusqueda: terminoNormalizado ? terminoNormalizado : undefined,
    estado: estadoQuery,
  });

  const total = (relevos || []).length;
  const totalLabel =
    total === 1 ? '1 cuidador' : `${total} cuidadores`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-blue-100 p-4 sticky top-0 z-10">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-blue-900">Directorio</h1>
          <p className="text-sm text-gray-500">{totalLabel}</p>
        </div>

        {/* Buscador */}
        <div className="relative mb-3">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            aria-label="Buscar cuidador por nombre"
            autoComplete="off"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-text text-sm"
          />
        </div>

        {/* Pills compactas */}
        <div className="flex gap-2 overflow-x-auto">
          {FILTROS.map((f) => {
            const activo = filtroEstado === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltroEstado(f.id)}
                aria-pressed={activo}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  activo
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="p-4 space-y-3 pb-8">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-white rounded-2xl border border-blue-100 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </>
        ) : total === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-blue-100">
            <UsersRound
              className="w-12 h-12 text-blue-200 mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-gray-500 text-sm">Sin cuidadores en el directorio.</p>
          </div>
        ) : (
          (relevos || []).map((relevo: RelevoItemResponse) => (
            <TarjetaCuidador
              key={relevo.id ?? relevo.telefono}
              relevo={relevo}
            />
          ))
        )}
      </div>
    </div>
  );
};
