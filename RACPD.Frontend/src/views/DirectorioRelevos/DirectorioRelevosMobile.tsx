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
  { id: 'NoDisponible', label: 'No disp.' },
];

/**
 * Vista Mobile del Directorio de Relevos.
 *
 * Header sticky con buscador y pills compactas; lista vertical debajo.
 * Botón compacto para agregar relevo (lo provee el Contenedor).
 *
 * El filtro por dependiente vive en el Contenedor (compartido con
 * Desktop) — aquí solo se renderiza un select compacto cuando hay más
 * de un dependiente visible.
 */
export const DirectorioRelevosMobile = ({ header }: { header: DirectorioHeader }) => {
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-blue-100 p-4 sticky top-0 z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-blue-900">Directorio</h1>
            <p className="text-sm text-gray-500">{totalLabel}</p>
          </div>
          {header.onAgregar && (
            <button
              onClick={header.onAgregar}
              title={header.tooltipBloqueado}
              aria-label="Agregar relevo"
              className="!w-11 !h-11 !p-0 !rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 inline-flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
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

        {/* Pills compactas + filtro dependiente */}
        <div className="flex gap-2 overflow-x-auto items-center">
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

          {mostrarFiltroDependiente && (
            <div className="inline-flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
              <select
                aria-label="Filtrar por dependiente"
                value={header.filtroDependienteId ?? ''}
                onChange={(e) =>
                  header.onCambiarFiltroDependiente?.(
                    e.target.value === '' ? undefined : e.target.value,
                  )
                }
                className="px-2 py-1.5 border border-blue-200 rounded-lg bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              puedeEditar={header.puedeEditar}
              onEditar={header.onEditar}
              puedeEliminar={header.puedeEliminar}
              onEliminar={header.onEliminar}
            />
          ))
        )}
      </div>
    </div>
  );
};
