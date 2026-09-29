import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Calendar, AlertTriangle, CheckCircle2, ArrowRight, User, ChevronLeft, ChevronRight } from 'lucide-react';
import type { NotificacionTurno } from '../../features/agenda/hooks/useNotificacionesResumen';

interface RadarAlertaSemanalProps {
  /** Turnos del día actual (de `datos.hoy`). */
  turnosHoy: NotificacionTurno[];
  /** Turnos de los próximos días (de `datos.semana`). */
  turnosSemana: NotificacionTurno[];
  cargando: boolean;
}

const ELEMENTOS_POR_PAGINA = 10;

const capitalizar = (texto: string): string =>
  texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Parsea la fecha YYYY-MM-DD del backend como local (sin corrimiento de zona).
 */
const parsearFechaLocal = (yyyyMmDd: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
};

/**
 * Formatea la fecha del bloque como "Mié, 23 sept".
 */
const formatearFecha = (yyyyMmDd: string | undefined): string => {
  if (!yyyyMmDd) return 'Fecha por confirmar';
  const fecha = parsearFechaLocal(yyyyMmDd);
  if (!fecha) return 'Fecha por confirmar';
  const etiqueta = fecha.toLocaleDateString('es-EC', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return capitalizar(etiqueta);
};

/**
 * Sufijo " (hoy)" para destacar visualmente que es un turno del día en curso.
 */
const sufijoHoy = (yyyyMmDd: string | undefined): string => {
  if (!yyyyMmDd) return '';
  const fecha = parsearFechaLocal(yyyyMmDd);
  if (!fecha) return '';
  const hoy = new Date();
  if (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  ) {
    return ' (hoy)';
  }
  return '';
};

/**
 * Genera el subtítulo con el rango dinámico de los próximos 7 días:
 * ej. "(Del Mar, 29 sept al Lun, 05 oct)"
 * Usa la fecha del primer turno de hoy como ancla en Ecuador si existe.
 */
const calcularRangoProximos7Dias = (fechaHoyEcuador?: string): string => {
  const hoy = fechaHoyEcuador ? parsearFechaLocal(fechaHoyEcuador) ?? new Date() : new Date();
  const fin = new Date(hoy);
  fin.setDate(hoy.getDate() + 6);

  const formato = (d: Date) =>
    capitalizar(
      d.toLocaleDateString('es-EC', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
    );

  return `Del ${formato(hoy)} al ${formato(fin)}`;
};

/**
 * RadarAlertaSemanal
 *
 * Muestra los turnos de la ventana deslizante de 7 días (hoy + 6 días hacia adelante).
 * Permite filtrar entre "Todos" y "Por cubrir", con scroll interno y paginación
 * cada 10 elementos para no romper la armonía del Dashboard.
 */
export const RadarAlertaSemanal = ({
  turnosHoy,
  turnosSemana,
  cargando,
}: RadarAlertaSemanalProps) => {
  const [filtro, setFiltro] = useState<'todos' | 'pendientes'>('todos');
  const [paginaActual, setPaginaActual] = useState(1);

  // Unificamos y ordenamos cronológicamente todos los turnos
  const todosLosTurnos = useMemo(() => {
    return [...turnosHoy, ...turnosSemana].sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.horaInicio.localeCompare(b.horaInicio);
    });
  }, [turnosHoy, turnosSemana]);

  const pendientesCount = useMemo(
    () => todosLosTurnos.filter((t) => t.estado === 'Disponible').length,
    [todosLosTurnos],
  );

  const turnosFiltrados = useMemo(() => {
    if (filtro === 'pendientes') {
      return todosLosTurnos.filter((t) => t.estado === 'Disponible');
    }
    return todosLosTurnos;
  }, [todosLosTurnos, filtro]);

  const totalPaginas = Math.max(1, Math.ceil(turnosFiltrados.length / ELEMENTOS_POR_PAGINA));

  // Ajuste defensivo de página actual al cambiar de filtro
  const paginaValida = Math.min(paginaActual, totalPaginas);

  const turnosPaginados = useMemo(() => {
    const inicio = (paginaValida - 1) * ELEMENTOS_POR_PAGINA;
    return turnosFiltrados.slice(inicio, inicio + ELEMENTOS_POR_PAGINA);
  }, [turnosFiltrados, paginaValida]);

  const subtituloRango = useMemo(
    () => calcularRangoProximos7Dias(turnosHoy[0]?.fecha),
    [turnosHoy],
  );

  return (
    <section
      className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5 md:p-6 h-full flex flex-col"
      aria-label="Radar de los próximos 7 días"
    >
      <header className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-900">
              Radar de la semana
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100">
            {subtituloRango}
          </span>
        </div>
        <p className="text-xs text-blue-600/80">
          Vista continua de turnos programados para los próximos 7 días.
        </p>

        {/* Selector de Filtros */}
        <div className="flex items-center gap-2 mt-3" role="tablist" aria-label="Filtro de turnos">
          <button
            type="button"
            role="tab"
            aria-selected={filtro === 'todos'}
            onClick={() => {
              setFiltro('todos');
              setPaginaActual(1);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filtro === 'todos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Todos ({todosLosTurnos.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtro === 'pendientes'}
            onClick={() => {
              setFiltro('pendientes');
              setPaginaActual(1);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              filtro === 'pendientes'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Por cubrir ({pendientesCount})
          </button>
        </div>
      </header>

      {cargando ? (
        <ul className="space-y-2.5 flex-1" aria-busy="true" aria-label="Cargando turnos">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-14 rounded-xl bg-blue-50/70 border border-blue-100 animate-pulse"
            />
          ))}
        </ul>
      ) : turnosFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-emerald-900">
            {filtro === 'pendientes'
              ? '¡Excelente! Todos los relevos de los próximos 7 días están cubiertos.'
              : 'No hay turnos programados en los próximos 7 días.'}
          </p>
        </div>
      ) : (
        <>
          {/* Lista con scroll vertical acotado */}
          <div className="flex-1 max-h-[360px] overflow-y-auto pr-1 space-y-2" role="region" aria-label="Lista de turnos">
            <ul className="space-y-2" role="list">
              {turnosPaginados.map((turno) => {
                const diaLabel = `${formatearFecha(turno.fecha)}${sufijoHoy(turno.fecha)}`;
                const horario = `${turno.horaInicio ?? '--:--'} – ${turno.horaFin ?? '--:--'}`;
                const sinAsignar = turno.estado === 'Disponible';
                const dependiente = turno.dependienteNombre ?? 'Dependiente';

                return (
                  <li
                    key={`${turno.bloqueId}-${turno.fecha}-${turno.horaInicio}`}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                      sinAsignar
                        ? 'bg-amber-50/90 border-amber-200/80 hover:border-amber-300'
                        : 'bg-slate-50/80 border-slate-200/80 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          sinAsignar
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {sinAsignar ? (
                          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <User className="w-4 h-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-bold truncate ${
                              sinAsignar ? 'text-amber-950' : 'text-slate-900'
                            }`}
                            title={diaLabel}
                          >
                            {diaLabel}
                          </p>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                              turno.estado === 'Completado'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : sinAsignar
                                  ? 'bg-amber-200/70 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {turno.estado === 'Completado'
                              ? 'Concluido'
                              : sinAsignar
                                ? 'Sin asignar'
                                : turno.cuidadorAsignadoNombre === 'Yo'
                                  ? 'Cubierto por ti'
                                  : (turno.cuidadorAsignadoNombre ?? 'Asignado')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">
                          <span className="font-medium text-slate-700">{horario}</span> ·{' '}
                          {turno.perfilDependienteId ? (
                            <Link
                              to="/dependientes/$perfilId"
                              params={{ perfilId: turno.perfilDependienteId }}
                              className="text-slate-700 hover:text-blue-800 underline decoration-slate-300 hover:decoration-blue-500 underline-offset-2 cursor-pointer transition-colors"
                              title={`Ver ficha médica de ${dependiente}`}
                            >
                              {dependiente}
                            </Link>
                          ) : (
                            dependiente
                          )}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/agenda"
                      search={
                        turno.bloqueId
                          ? { bloqueIdDestacado: turno.bloqueId }
                          : undefined
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap pl-2"
                      aria-label={`Ver turno de ${diaLabel}`}
                    >
                      {sinAsignar ? 'Cubrir' : 'Ver'}
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Paginación si hay más de 10 elementos */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-blue-100 pt-2.5 mt-2 text-xs text-blue-900">
              <span>
                Página {paginaValida} de {totalPaginas} ({turnosFiltrados.length} turnos)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaValida === 1}
                  className="p-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaValida === totalPaginas}
                  className="p-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <Link
            to="/agenda"
            className="mt-3 inline-flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98]"
          >
            Abrir agenda completa
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
};
