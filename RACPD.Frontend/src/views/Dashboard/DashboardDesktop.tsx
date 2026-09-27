import { CalendarDays, CalendarCheck2, HeartHandshake, Smile, AlertCircle } from 'lucide-react';
import { EncabezadoEmpatico } from './EncabezadoEmpatico';
import { TarjetaMetrica } from './TarjetaMetrica';
import { TarjetaTurnoEnCurso } from './TarjetaTurnoEnCurso';
import { RadarAlertaSemanal } from './RadarAlertaSemanal';
import { BannerRelevoUrgente } from './BannerRelevoUrgente';
import type { NotificacionTurno } from '../../features/agenda/hooks/useNotificacionesResumen';

interface DashboardDesktopProps {
  nombreCuidador: string;
  nombreDependiente: string;
  kpiTurnosHoy: { total: number; cubiertos: number };
  kpiCoberturaSemanal: { cubiertos: number; pendientes: number };
  cuidadoresDisponibles: number;
  kpiEstadoAnimo: {
    valor: string;
    subtexto: string;
    icono: 'excelente' | 'bueno' | 'neutral' | 'alerta' | 'critico';
    tono: 'primario' | 'exito' | 'alerta';
  };
  cargandoNotificaciones: boolean;
  cargandoRelevos: boolean;
  cargandoEstadoAnimo?: boolean;
  hayErrorNotificaciones: boolean;
  hayErrorRelevos: boolean;
  reintentarNotificaciones: () => void;
  reintentarRelevos: () => void;
  turnoEnCurso: NotificacionTurno | null;
  turnosHoy: NotificacionTurno[];
  turnosSemana: NotificacionTurno[];
}

/**
 * DashboardDesktop
 *
 * Layout ≥768px: grid de 12 columnas. Fila 1 = 4 KPIs (3 cols c/u).
 * Fila 2 = TurnoEnCurso (7 cols) + RadarSemanal (5 cols).
 * Fila 3 = BannerRelevo full-width.
 *
 * Sin `useEffect` propio; todos los datos vienen del contenedor padre.
 */
export const DashboardDesktop = ({
  nombreCuidador,
  nombreDependiente,
  kpiTurnosHoy,
  kpiCoberturaSemanal,
  cuidadoresDisponibles,
  kpiEstadoAnimo,
  cargandoNotificaciones,
  cargandoRelevos,
  cargandoEstadoAnimo = false,
  hayErrorNotificaciones,
  hayErrorRelevos,
  reintentarNotificaciones,
  reintentarRelevos,
  turnoEnCurso,
  turnosHoy,
  turnosSemana,
}: DashboardDesktopProps) => {
  return (
    <div className="min-h-full bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 md:p-8 space-y-6">
      <EncabezadoEmpatico
        nombreCuidador={nombreCuidador}
        nombreDependiente={nombreDependiente}
      />

      {/* === Fila KPIs (4 columnas) === */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        aria-label="Indicadores clave"
      >
        <TarjetaMetrica
          etiqueta="Turnos de hoy"
          valor={kpiTurnosHoy.total}
          subtexto={`${kpiTurnosHoy.cubiertos} cubiertos · ${kpiTurnosHoy.total - kpiTurnosHoy.cubiertos} pendientes`}
          icono={CalendarDays}
          tono="primario"
          cargando={cargandoNotificaciones}
        />
        <TarjetaMetrica
          etiqueta="Cobertura semanal"
          valor={`${kpiCoberturaSemanal.cubiertos}/${kpiCoberturaSemanal.cubiertos + kpiCoberturaSemanal.pendientes}`}
          subtexto={`${kpiCoberturaSemanal.pendientes} pendiente${kpiCoberturaSemanal.pendientes === 1 ? '' : 's'}`}
          icono={CalendarCheck2}
          tono={kpiCoberturaSemanal.pendientes === 0 ? 'exito' : 'alerta'}
          cargando={cargandoNotificaciones}
        />
        <TarjetaMetrica
          etiqueta="Cuidadores disponibles"
          valor={cuidadoresDisponibles}
          subtexto="En tu red de apoyo"
          icono={HeartHandshake}
          tono="exito"
          cargando={cargandoRelevos}
        />
        <TarjetaMetrica
          etiqueta="Último ánimo reportado"
          valor={kpiEstadoAnimo.valor}
          subtexto={kpiEstadoAnimo.subtexto}
          icono={kpiEstadoAnimo.tono === 'alerta' ? AlertCircle : Smile}
          tono={kpiEstadoAnimo.tono}
          cargando={cargandoEstadoAnimo}
        />
      </section>

      {/* === Fila módulos centrales === */}
      <section
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        aria-label="Módulos principales del día"
      >
        <div className="lg:col-span-7">
          {hayErrorNotificaciones ? (
            <ErrorReintentar
              mensaje="No pudimos cargar el resumen de turnos."
              onReintentar={reintentarNotificaciones}
            />
          ) : (
            <TarjetaTurnoEnCurso
              turno={turnoEnCurso}
              cargando={cargandoNotificaciones}
            />
          )}
        </div>
        <div className="lg:col-span-5">
          {hayErrorNotificaciones ? (
            <ErrorReintentar
              mensaje="No pudimos cargar el radar semanal."
              onReintentar={reintentarNotificaciones}
            />
          ) : (
            <RadarAlertaSemanal
              turnosHoy={turnosHoy}
              turnosSemana={turnosSemana}
              cargando={cargandoNotificaciones}
            />
          )}
        </div>
      </section>

      {/* === Banner inferior === */}
      {hayErrorRelevos && (
        <ErrorReintentar
          mensaje="No pudimos cargar la red de cuidadores."
          onReintentar={reintentarRelevos}
        />
      )}
      <BannerRelevoUrgente />
    </div>
  );
};

interface ErrorReintentarProps {
  mensaje: string;
  onReintentar: () => void;
}

const ErrorReintentar = ({ mensaje, onReintentar }: ErrorReintentarProps) => (
  <div
    className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center"
    role="alert"
  >
    <p className="text-red-800 font-medium mb-3">{mensaje}</p>
    <button
      type="button"
      onClick={onReintentar}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer active:scale-[0.98]"
    >
      Reintentar
    </button>
  </div>
);
