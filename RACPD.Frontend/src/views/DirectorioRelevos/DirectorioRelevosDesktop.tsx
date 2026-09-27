import { useState } from 'react';
import { Search, UsersRound, Plus, Filter } from 'lucide-react';
import {
  useDirectorioRelevos,
  type RelevoItemResponse,
} from '../../features/directorio-relevos/hooks/useDirectorioRelevos';
import { TarjetaCuidador } from './TarjetaCuidador';
import type { DirectorioHeader } from './DirectorioHeader';

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
 *
 * El filtro por dependiente lo provee el Contenedor via `header`
 * (compartido con Mobile), porque la lista de dependientes visibles
 * vive en el padre.
 *
 * El botón "Agregar relevo" lo provee el Contenedor via la prop
 * `header.onAgregar` (compartido con Mobile).
 */
export const DirectorioRelevosDesktop = ({ header }: { header: DirectorioHeader }) => {
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('Todos');

  const estadoQuery = filtroEstado === 'Todos' ? undefined : filtroEstado;
  const terminoNormalizado = terminoBusqueda.trim();

  const { relevos, isLoading } = useDirectorioRelevos({
    terminoBusqueda: terminoNormalizado ? terminoNormalizado : undefined,
    estado: estadoQuery,
    perfilDependienteId: header.filtroDependienteId,
  });

  const total = (relevos || []).length;
  const totalLabel =
    total === 1 ? '1 cuidador' : `${total} cuidadores`;

  const mostrarFiltroDependiente =
    header.perfilesDependientes !== undefined &&
    header.perfilesDependientes.length > 1;

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
        {header.onAgregar && (
          <button
            onClick={header.onAgregar}
            title={header.tooltipBloqueado}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar relevo
          </button>
        )}
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

        {/* Filtro por dependiente (solo si hay > 1) */}
        {mostrarFiltroDependiente && (
          <div className="ml-2 inline-flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <label htmlFor="filtro-dependiente" className="text-sm text-gray-600">
              Dependiente:
            </label>
            <select
              id="filtro-dependiente"
              value={header.filtroDependienteId ?? ''}
              onChange={(e) =>
                header.onCambiarFiltroDependiente?.(
                  e.target.value === '' ? undefined : e.target.value,
                )
              }
              className="px-3 py-1.5 border border-blue-200 rounded-lg bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {header.perfilesDependientes?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreCompleto}
                </option>
              ))}
            </select>
          </div>
        )}

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
            <TarjetaCuidador
              key={relevo.id ?? relevo.telefono}
              relevo={relevo}
              puedeEditar={header.puedeEditar}
              onEditar={header.onEditar}
              puedeEliminar={header.puedeEliminar}
              onEliminar={header.onEliminar}
            />
          ))}
        </div>
      )}
    </div>
  );
};
