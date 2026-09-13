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
  { id: 'NoDisponible', label: 'No disponibles' },
];

/**
 * Vista Desktop del Directorio de Relevos.
 *
 * Estado local:
 *   - terminoBusqueda: string controlado por input.
 *   - filtroEstado: pills de estado.
 *
 * El hook `useDirectorioRelevos` aplica los filtros server-side, por
 * lo que cambiar el filtro dispara un fetch fresco (con keepPreviousData
 * para evitar parpadeo).
 */
export const DirectorioRelevosDesktop = () => {
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">
            Directorio de Relevos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cuidadores de apoyo disponibles para coordinar relevos.
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
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
          className="w-full pl-10 pr-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-text"
        />
      </div>

      {/* Filtros pill */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTROS.map((f) => {
          const activo = filtroEstado === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltroEstado(f.id)}
              aria-pressed={activo}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activo
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="text-sm text-gray-500 ml-2">{totalLabel}</span>
      </div>

      {/* Listado */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-white rounded-2xl border border-blue-100 animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-blue-100">
          <UsersRound className="w-16 h-16 text-blue-200 mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-500 text-lg">No hay cuidadores en el directorio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {(relevos || []).map((relevo: RelevoItemResponse) => (
            <TarjetaCuidador key={relevo.id ?? relevo.telefono} relevo={relevo} />
          ))}
        </div>
      )}
    </div>
  );
};
