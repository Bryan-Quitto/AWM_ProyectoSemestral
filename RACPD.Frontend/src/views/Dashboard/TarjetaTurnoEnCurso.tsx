import { Link } from '@tanstack/react-router';
import { Clock, User, ArrowRight, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import type { NotificacionTurno } from '../../features/agenda/hooks/useNotificacionesResumen';

interface TarjetaTurnoEnCursoProps {
  turno: NotificacionTurno | null;
  cargando: boolean;
}

/**
 * TarjetaTurnoEnCurso
 *
 * Módulo central del Dashboard. Tres estados visuales:
 *  1. Cargando → 3 esqueletos (Zero-Wait).
 *  2. Sin turnos hoy → tarjeta serena "día de cuidado familiar directo".
 *  3. Con turno → borde lateral verde si cubierto, rojo si "Sin asignar";
 *     CTA funcional "Ver detalles en la Agenda" (Link a /agenda).
 *
 * Decisión de diseño (post-análisis):
 * - El DTO `NotificacionTurno` no expone el teléfono del cuidador asignado
 *   (la entidad `Usuario` no tiene columna Telefono; evitar migraciones en
 *   este sprint). Por tanto, los CTAs WhatsApp/Llamar al cuidador NO son
 *   viables sin cambios de mayor alcance (nueva propiedad en Usuario +
 *   migración + endpoint de edición + UI).
 * - Se reemplaza por un único CTA "Ver detalles en la Agenda" (Link a
 *   /agenda) que SÍ es funcional, dirige al cuidador al lugar correcto
 *   para gestionar el turno y mantiene la regla "cero botones inertes".
 */
export const TarjetaTurnoEnCurso = ({ turno, cargando }: TarjetaTurnoEnCursoProps) => {
  if (cargando) {
    return (
      <div
        className="bg-white border border-blue-100 rounded-2xl shadow-sm p-6 animate-pulse min-h-[220px]"
        aria-busy="true"
        aria-label="Cargando turno de hoy"
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

  if (!turno) {
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

  // Consideramos "sin asignar" cuando el estado es Disponible (sin reserva
  // activa). No usamos `cuidadorAsignadoNombre === null` porque el backend
  // setea "Yo" cuando el cuidador principal crea el bloque, aunque no haya
  // reserva. El campo `estado` es la fuente de verdad.
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
      aria-label="Turno de hoy"
    >
      <header className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-700" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Turno de hoy
        </h2>
      </header>

      <div className="flex-1 space-y-3">
        <p className="text-xl md:text-2xl font-bold text-blue-900 leading-tight">
          {dependiente}
        </p>
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
