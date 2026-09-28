import { Link } from '@tanstack/react-router';
import { Calendar, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { NotificacionTurno } from '../../features/agenda/hooks/useNotificacionesResumen';

interface RadarAlertaSemanalProps {
  /** Turnos del día actual (de `datos.hoy`). */
  turnosHoy: NotificacionTurno[];
  /** Turnos del resto de la semana actual (de `datos.semana`). */
  turnosSemana: NotificacionTurno[];
  cargando: boolean;
}

const capitalizar = (texto: string): string =>
  texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Parsea la fecha YYYY-MM-DD del backend como local (sin corrimiento de zona).
 * Construimos el Date con `new Date(yyyy, mm-1, dd)` para evitar que la
 * interpretación UTC reste un día en zonas horarias negativas.
 */
const parsearFechaLocal = (yyyyMmDd: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
};

/**
 * Formatea la fecha del bloque como "Miércoles, 23 sept".
 */
const formatearFecha = (yyyyMmDd: string | undefined): string => {
  if (!yyyyMmDd) return 'Fecha por confirmar';
  const fecha = parsearFechaLocal(yyyyMmDd);
  if (!fecha) return 'Fecha por confirmar';
  const etiqueta = fecha.toLocaleDateString('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
  return capitalizar(etiqueta);
};

/**
 * Sufijo "hoy" para destacar visualmente que es un turno del día en curso.
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
 * RadarAlertaSemanal
 *
 * Lista de turnos pendientes (cuidadorAsignadoNombre === null) en la
 * semana actual (hoy + días futuros). Si la lista está vacía → mensaje
 * positivo con check. Cada ítem enlaza a /agenda para gestionar el relevo.
 *
 * La fecha se lee del campo `turno.fecha` (YYYY-MM-DD) provisto por el
 * backend — antes se infería del índice del array, lo que daba etiquetas
 * incorrectas cuando el backend reordenaba.
 */
export const RadarAlertaSemanal = ({
  turnosHoy,
  turnosSemana,
  cargando,
}: RadarAlertaSemanalProps) => {
  // Defensa en profundidad: el contenedor pasa los arrays crudos `hoy` y
  // `semana`; aquí los combinamos, filtramos los pendientes sin asignar y
  // los ordenamos cronológicamente. De este modo, si el backend decide
  // mover un turno entre `hoy` y `semana` (reglas de visibilidad), el radar
  // lo refleja sin coordinarse con el contenedor.
  // IMPORTANTE: usamos `estado === 'Disponible'` como único criterio de
  // "pendiente". El campo `cuidadorAsignadoNombre` no es fiable porque el
  // backend lo setea a "Yo" cuando el cuidador principal crea el bloque
  // (aunque NO haya reserva activa).
  const pendientes = [...turnosHoy, ...turnosSemana]
    .filter((t) => t.estado === 'Disponible')
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.horaInicio.localeCompare(b.horaInicio);
    });

  return (
    <section
      className="bg-white border border-blue-100 rounded-2xl shadow-sm p-6 h-full flex flex-col"
      aria-label="Radar de turnos por cubrir"
    >
      <header className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-blue-700" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Radar de la semana
        </h2>
      </header>

      {cargando ? (
        <ul className="space-y-3 flex-1" aria-busy="true" aria-label="Cargando turnos pendientes">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-16 rounded-xl bg-blue-50 border border-blue-100 animate-pulse"
            />
          ))}
        </ul>
      ) : pendientes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="text-sm md:text-base font-medium text-emerald-800">
            ¡Excelente! Todos los relevos de la semana están cubiertos.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 flex-1 overflow-y-auto" role="list">
            {pendientes.map((turno, idx) => {
              const diaLabel = `${formatearFecha(turno.fecha)}${sufijoHoy(turno.fecha)}`;
              const horario = `${turno.horaInicio ?? '--:--'} – ${turno.horaFin ?? '--:--'}`;
              return (
                <li
                  key={turno.bloqueId ?? `${idx}-${turno.horaInicio}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold text-amber-900 truncate"
                        title={diaLabel}
                      >
                        {diaLabel}
                      </p>
                      <p className="text-xs text-amber-800/80">{horario}</p>
                    </div>
                  </div>
                  <Link
                    to="/agenda"
                    // Deep-link: cada "Gestionar" apunta al turno concreto
                    // del item del Radar. Antes era un link genérico a la
                    // agenda → el cuidador llegaba y tenía que volver a
                    // encontrar el lunes 28 sept a ojo. Ahora la Agenda
                    // salta al día, hace scroll y aplica el highlight.
                    search={
                      turno.bloqueId
                        ? { bloqueIdDestacado: turno.bloqueId }
                        : undefined
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                    aria-label={`Gestionar relevo de ${diaLabel}`}
                  >
                    Gestionar
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            to="/agenda"
            // "Abrir agenda completa" sigue siendo genérico (sin search
            // param): el cuidador quiere ver TODO, no uno específico.
            className="mt-4 inline-flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer active:scale-[0.98]"
          >
            Abrir agenda completa
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
};
