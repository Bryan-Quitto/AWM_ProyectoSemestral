import { Link } from '@tanstack/react-router';
import {
  ClipboardCheck,
  CheckCircle2,
  Moon,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  User,
  Calendar,
} from 'lucide-react';
import { ModalDetalle } from '../../components/ModalDetalle';
import { Boton } from '../../components/Boton';
import {
  ETIQUETAS_ESTADO_ANIMO,
  type EstadoAnimoBitacora,
} from '../Agenda/bitacoraSchema';
import type { RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto } from '../../api/generated/model';

interface ModalDetalleBitacoraDashboardProps {
  abierto: boolean;
  onCerrar: () => void;
  bitacora: RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | null;
  cargando: boolean;
  error: unknown;
  onReintentar?: () => void;
  bloqueId?: string;
  nombreDependiente?: string;
  dependienteId?: string;
}

export const ModalDetalleBitacoraDashboard = ({
  abierto,
  onCerrar,
  bitacora,
  cargando,
  error,
  onReintentar,
  bloqueId,
  nombreDependiente = 'Dependiente',
  dependienteId,
}: ModalDetalleBitacoraDashboardProps) => {
  return (
    <ModalDetalle
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Último reporte clínico y de ánimo"
      icono={<ClipboardCheck className="w-5 h-5 text-emerald-600" />}
    >
      <div className="space-y-3 p-1 text-sm">
        {cargando && (
          <div className="p-6 bg-blue-50/60 border border-blue-100 rounded-xl text-center text-blue-700 animate-pulse">
            <p className="font-medium">Cargando reporte de bitácora...</p>
          </div>
        )}

        {!cargando && Boolean(error) && (
          <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-700" />
            <div className="flex-1">
              <p className="font-semibold">No se pudo cargar la bitácora.</p>
              <p className="text-xs mt-1 text-amber-800">
                Es posible que aún no haya un turno cerrado o que la conexión haya tenido un problema.
              </p>
              {onReintentar && (
                <button
                  type="button"
                  onClick={onReintentar}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}

        {!cargando && !error && bitacora && (
          <>
            {/* Encabezado: dependiente + badge turno cerrado */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Turno cerrado recientemente
                </p>
                {dependienteId ? (
                  <Link
                    to="/dependientes/$perfilId"
                    params={{ perfilId: dependienteId }}
                    onClick={onCerrar}
                    className="font-bold text-emerald-950 text-base hover:text-blue-900 underline decoration-emerald-300 hover:decoration-blue-700 underline-offset-2 inline-flex items-center gap-1 cursor-pointer transition-colors"
                    title={`Ver ficha médica completa de ${nombreDependiente}`}
                  >
                    {nombreDependiente}
                    <ArrowRight className="w-3.5 h-3.5 inline-block opacity-75" />
                  </Link>
                ) : (
                  <p className="font-bold text-emerald-950 text-base">
                    {nombreDependiente}
                  </p>
                )}
              </div>
              {bitacora.registradoPor?.nombreCompleto && (
                <div className="text-right">
                  <span className="text-[11px] text-emerald-800 font-medium inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {bitacora.registradoPor.nombreCompleto}
                  </span>
                </div>
              )}
            </div>

            {/* Estado de ánimo */}
            <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-xl">
              <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-1">
                Estado de ánimo observado
              </p>
              <p className="font-bold text-sky-950 text-lg">
                {ETIQUETAS_ESTADO_ANIMO[bitacora.estadoAnimo as EstadoAnimoBitacora] ??
                  bitacora.estadoAnimo ??
                  'No registrado'}
              </p>
            </div>

            {/* Horas de sueño */}
            <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-blue-600" />
                  Horas de descanso / sueño
                </p>
                <p className="font-bold text-blue-900 text-base mt-0.5">
                  {bitacora.horasSueno != null
                    ? `${bitacora.horasSueno} horas`
                    : 'No especificado'}
                </p>
              </div>
            </div>

            {/* Síntomas reportados */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
              <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">
                Síntomas reportados
              </p>
              <p className="text-amber-950 whitespace-pre-wrap break-words font-medium">
                {bitacora.sintomas && bitacora.sintomas.trim().length > 0
                  ? bitacora.sintomas
                  : 'Sin síntomas o malestares reportados.'}
              </p>
            </div>

            {/* Observaciones generales */}
            {bitacora.observacionesGenerales && (
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Observaciones adicionales
                </p>
                <p className="text-gray-800 whitespace-pre-wrap break-words">
                  {bitacora.observacionesGenerales}
                </p>
              </div>
            )}

            {/* Tareas del turno registradas */}
            {bitacora.tareasDelBloque && bitacora.tareasDelBloque.length > 0 && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Cuidados y tareas del turno
                </p>
                <ul className="space-y-1.5 list-none">
                  {bitacora.tareasDelBloque.map((tarea, idx) => {
                    const realizada = Boolean(
                      tarea.id && bitacora.tareasRealizadasIds?.includes(tarea.id),
                    );
                    return (
                      <li
                        key={tarea.id ?? idx}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                          realizada
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <span
                          className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
                            realizada
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                          aria-hidden="true"
                        >
                          {realizada ? '✓' : '·'}
                        </span>
                        <span
                          className={`leading-snug ${
                            realizada
                              ? 'line-through text-emerald-900/70'
                              : 'text-slate-800'
                          }`}
                        >
                          {tarea.descripcion}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Acciones al pie del modal */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              {bloqueId && (
                <Link
                  to="/agenda"
                  search={{ bloqueIdDestacado: bloqueId }}
                  onClick={onCerrar}
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  Ver turno en la Agenda
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <Boton
                variante="secundario"
                onClick={onCerrar}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium cursor-pointer"
              >
                Cerrar
              </Boton>
            </div>
          </>
        )}
      </div>
    </ModalDetalle>
  );
};
