import { CalendarDays, CalendarCheck2, HeartHandshake, Smile, AlertCircle } from 'lucide-react';
import { EncabezadoEmpatico } from './EncabezadoEmpatico';
import { TarjetaMetrica } from './TarjetaMetrica';
import { TarjetaTurnoEnCurso } from './TarjetaTurnoEnCurso';
import { RadarAlertaSemanal } from './RadarAlertaSemanal';
import { BannerRelevoUrgente } from './BannerRelevoUrgente';
import type { TurnoRelevanteHoy } from './DashboardContenedor';
import type { NotificacionTurno } from '../../features/agenda/hooks/useNotificacionesResumen';

interface DashboardMobileProps {
  nombreCuidador: string;
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
  turnoRelevante: TurnoRelevanteHoy | null;
  turnosHoyConcluidos?: boolean;
  turnosHoy: NotificacionTurno[];
  turnosSemana: NotificacionTurno[];
  onAbrirBitacora?: () => void;
}

/**
 * DashboardMobile
 *
 * Layout <768px: stack vertical full-width, espaciado táctil (gap-4 p-4).
 * KPIs en grid 2×2, luego turno, radar y banner. Misma lógica derivada
 * que Desktop; la única diferencia es el grid.
 */
export const DashboardMobile = ({
  nombreCuidador,
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
  turnoRelevante,
  turnosHoyConcluidos,
  turnosHoy,
  turnosSemana,
  onAbrirBitacora,
}: DashboardMobileProps) => {
  return (
    <div className="min-h-full bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 space-y-4">
      <EncabezadoEmpatico nombreCuidador={nombreCuidador} />

      {/* === KPIs en grid 2×2 === */}
      <section className="grid grid-cols-2 gap-4" aria-label="Indicadores clave">
        <TarjetaMetrica
          etiqueta="Turnos hoy"
          valor={kpiTurnosHoy.total}
          subtexto={`${kpiTurnosHoy.cubiertos} cubiertos`}
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
          etiqueta="Red disponible"
          valor={cuidadoresDisponibles}
          subtexto="Cuidadores"
          icono={HeartHandshake}
          tono="exito"
          cargando={cargandoRelevos}
        />
        <TarjetaMetrica
          etiqueta="Último ánimo"
          valor={kpiEstadoAnimo.valor}
          subtexto={kpiEstadoAnimo.subtexto}
          icono={kpiEstadoAnimo.tono === 'alerta' ? AlertCircle : Smile}
          tono={kpiEstadoAnimo.tono}
          cargando={cargandoEstadoAnimo}
          onClick={onAbrirBitacora}
          ariaLabelAccion="Ver reporte detallado de bitácora y estado de ánimo"
        />
      </section>

      {/* === Turno en curso === */}
      <section>
        {hayErrorNotificaciones ? (
          <ErrorReintentar
            mensaje="No pudimos cargar el resumen de turnos."
            onReintentar={reintentarNotificaciones}
          />
        ) : (
          <TarjetaTurnoEnCurso
            turnoRelevante={turnoRelevante}
            turnosHoyConcluidos={turnosHoyConcluidos}
            cargando={cargandoNotificaciones}
          />
        )}
      </section>

      {/* === Radar semanal === */}
      <section>
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
      </section>

      {/* === Banner inferior con botón full-width en Mobile === */}
      {hayErrorRelevos && (
        <ErrorReintentar
          mensaje="No pudimos cargar la red de cuidadores."
          onReintentar={reintentarRelevos}
        />
      )}
      <BannerRelevoUrgente fullWidthBoton />
    </div>
  );
};

interface ErrorReintentarProps {
  mensaje: string;
  onReintentar: () => void;
}

const ErrorReintentar = ({ mensaje, onReintentar }: ErrorReintentarProps) => (
  <div
    className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center"
    role="alert"
  >
    <p className="text-red-800 font-medium mb-3">{mensaje}</p>
    <button
      type="button"
      onClick={onReintentar}
      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer active:scale-[0.98]"
    >
      Reintentar
    </button>
  </div>
);
