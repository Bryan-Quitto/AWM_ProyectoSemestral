import { Link } from '@tanstack/react-router';
import { Clock, User, ArrowRight, CheckCircle2, AlertTriangle, Calendar, CheckCheck } from 'lucide-react';
import type { TurnoRelevanteHoy } from './DashboardContenedor';

interface TarjetaTurnoEnCursoProps {
  turnoRelevante: TurnoRelevanteHoy | null;
  turnosHoyConcluidos?: boolean;
  cargando: boolean;
}

/**
 * TarjetaTurnoEnCurso
 *
 * Módulo central del Dashboard con estado temporal dinámico:
 *  1. Cargando → esqueleto pulsante.
 *  2. Turnos de hoy concluidos → mensaje positivo y sereno de jornada completada.
 *  3. Sin turnos hoy → estado sereno "día de cuidado familiar directo".
 *  4. Con turno:
 *     - Si tipo === 'en-curso': Título "TURNO EN CURSO" con indicador visual en vivo (pulsing dot).
 *     - Si tipo === 'proximo': Título "PRÓXIMO TURNO DE HOY" con ícono de reloj.
 */
export const TarjetaTurnoEnCurso = ({
  turnoRelevante,
  turnosHoyConcluidos = false,
  cargando,
}: TarjetaTurnoEnCursoProps) => {
  if (cargando) {
    return (
      <div
        className="bg-white border border-blue-100 rounded-2xl shadow-sm p-6 animate-pulse min-h-[220px]"
        aria-busy="true"
        aria-label="Cargando información del turno de hoy"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-blue-200 rounded" />
          <div className="h-4 w-40 bg-blue-200 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-7 w-3/4 bg-blue-200 rounded" />
          <div className="h-4 w-1/2 bg-blue-100 rounded" />
          <div className="h-4 w-1/3 bg-blue-100 rounded" />
        </div>
      </div>
    );
  }

  // Estado: Todos los turnos programados para hoy ya finalizaron
  if (turnosHoyConcluidos) {
    return (
      <div
        className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 border border-emerald-100 rounded-2xl shadow-sm p-6 md:p-8 min-h-[220px] flex flex-col items-center justify-center text-center"
        role="status"
      >
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
          <CheckCheck className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-lg md:text-xl font-bold text-emerald-950 mb-2">
          Turnos de hoy concluidos
        </h2>
        <p className="text-sm md:text-base text-emerald-800/80 max-w-md">
          Todos los turnos programados para la jornada de hoy han finalizado satisfactoriamente.
        </p>
      </div>
    );
  }

  // Estado: No se programó ningún turno para el día de hoy
  if (!turnoRelevante?.turno) {
    return (
      <div
        className="bg-gradient-to-br from-sky-50 via-white to-blue-50 border border-blue-100 rounded-2xl shadow-sm p-6 md:p-8 min-h-[220px] flex flex-col items-center justify-center text-center"
        role="status"
      >
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-lg md:text-xl font-bold text-blue-900 mb-2">
          Sin turnos externos hoy
        </h2>
        <p className="text-sm md:text-base text-blue-700/80 max-w-md">
          No hay turnos externos programados para hoy. Día de cuidado familiar directo.
        </p>
      </div>
    );
  }

  const { turno, tipo } = turnoRelevante;
  const esEnCurso = tipo === 'en-curso';
  const sinAsignar = turno.estado === 'Disponible';
  const bordeLateral = sinAsignar ? 'border-l-red-400' : 'border-l-emerald-500';
  const dependiente = turno.dependienteNombre ?? 'Dependiente';
  const horario = `${turno.horaInicio ?? '--:--'} – ${turno.horaFin ?? '--:--'}`;
  const mensajeVacio = sinAsignar
    ? 'Este turno aún no tiene cuidador asignado. Ábrelo en la Agenda para gestionarlo.'
    : turno.cuidadorAsignadoNombre === 'Yo'
      ? 'Turno cubierto por ti.'
      : `Turno cubierto por ${turno.cuidadorAsignadoNombre}.`;

  return (
    <article
      className={`bg-white border border-blue-100 border-l-4 ${bordeLateral} rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 min-h-[220px] flex flex-col`}
      aria-label={esEnCurso ? 'Turno en curso' : 'Próximo turno de hoy'}
    >
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {esEnCurso ? (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          ) : (
            <Clock className="w-5 h-5 text-blue-700" aria-hidden="true" />
          )}
          <h2
            className={`text-sm font-semibold uppercase tracking-wide ${
              esEnCurso ? 'text-emerald-800 font-bold' : 'text-blue-700'
            }`}
          >
            {esEnCurso ? 'Turno en curso' : 'Próximo turno de hoy'}
          </h2>
        </div>

        {esEnCurso && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            En curso ahora
          </span>
        )}
      </header>
 
      <div className="flex-1 space-y-3">
        {turno.perfilDependienteId ? (
          <Link
            to="/dependientes/$perfilId"
            params={{ perfilId: turno.perfilDependienteId }}
            className="text-xl md:text-2xl font-bold text-blue-900 leading-tight hover:text-blue-700 underline decoration-blue-200 hover:decoration-blue-500 underline-offset-4 inline-flex items-center gap-1.5 cursor-pointer transition-colors group"
            title={`Ver ficha médica completa de ${dependiente}`}
          >
            <span>{dependiente}</span>
            <ArrowRight className="w-5 h-5 text-blue-600 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-xl md:text-2xl font-bold text-blue-900 leading-tight">
            {dependiente}
          </p>
        )}
        <p className="text-base font-medium text-blue-700">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" aria-hidden="true" />
            {horario}
          </span>
        </p>

        {sinAsignar ? (
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-xl text-sm font-medium border border-red-100">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Sin asignar
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl text-sm font-medium border border-emerald-100">
            <User className="w-4 h-4" aria-hidden="true" />
            {turno.cuidadorAsignadoNombre === 'Yo'
              ? 'Cubierto por ti'
              : turno.cuidadorAsignadoNombre}
          </div>
        )}

        <p className="text-sm text-blue-700/80 pt-1">{mensajeVacio}</p>
      </div>

      <div className="mt-4">
        <Link
          to="/agenda"
          search={turno.bloqueId ? { bloqueIdDestacado: turno.bloqueId } : undefined}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98]"
          aria-label="Ver detalles en la agenda"
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          Ver detalles en la Agenda
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
};
