import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Clock, User } from 'lucide-react';
import {
  useNotificacionesResumen,
  type NotificacionTurno,
} from '../../features/agenda/hooks/useNotificacionesResumen';

// Re-exportar tipo para consumidores existentes que importaban desde aqui.
export type { NotificacionTurno };

interface CampanaNotificacionesProps {
  tamanoIcono?: number;
  alineacionPopover?: 'izquierda' | 'derecha';
}

/**
 * Componente agnóstico que renderiza la Campana de Notificaciones
 * con un Popover ancla. Se reutiliza en el sidebar (Desktop) y en
 * el header superior (Mobile), con misma API.
 *
 * Regla de 3: usado en 2 lugares. Vale la abstracción.
 *
 * Persona 3 / Semana 2: consume el hook real useNotificacionesResumen
 * (SWR contra GET /api/agenda/notificaciones-resumen). Las reglas
 * de visibilidad (Apoyo vs Principal, isolation por dependiente)
 * viven en el backend — el cliente NO filtra para evitar
 * desincronización.
 */
export const CampanaNotificaciones = ({
  tamanoIcono = 20,
  alineacionPopover = 'derecha',
}: CampanaNotificacionesProps) => {
  const [abierto, setAbierto] = useState(false);
  const [semanaExpandida, setSemanaExpandida] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const { datos, isLoading: cargando, error } = useNotificacionesResumen();

  // Click-outside + Escape para cerrar el popover.
  useEffect(() => {
    if (!abierto) return;
    const handleClickFuera = (event: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target as Node)) {
        setAbierto(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [abierto]);

  const totalNotificaciones = useMemo(
    () => (datos ? datos.hoy.length + datos.semana.length : 0),
    [datos],
  );

  const clasesBoton =
    'p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors cursor-pointer active:scale-95';

  const clasesPopover =
    `absolute top-full mt-2 ${alineacionPopover === 'derecha' ? 'right-0' : 'left-0'} ` +
    'w-80 sm:w-96 bg-white border border-blue-200 rounded-2xl shadow-xl z-50 overflow-hidden ' +
    'animate-in fade-in slide-in-from-top-2 ' +
    'max-h-[80vh] flex flex-col';

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`${clasesBoton} relative`}
        aria-label="Notificaciones"
        aria-expanded={abierto}
        aria-haspopup="dialog"
      >
        <Bell size={tamanoIcono} />
        {totalNotificaciones > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
                       bg-red-600 text-white text-[10px] font-bold rounded-full
                       flex items-center justify-center border-2 border-white
                       pointer-events-none"
            aria-label={`${totalNotificaciones} notificaciones`}
          >
            {totalNotificaciones > 99 ? '99+' : totalNotificaciones}
          </span>
        )}
      </button>

      {abierto && (
        <div className={clasesPopover} role="dialog" aria-label="Notificaciones">
          <header className="px-4 py-3 bg-gradient-to-r from-sky-600 to-blue-500 text-white">
            <div className="flex items-center gap-2">
              <Bell size={16} />
              <h2 className="font-bold text-sm uppercase tracking-wide">Notificaciones</h2>
            </div>
            <p className="text-xs text-sky-50/90 mt-0.5">
              Resumen de tus turnos en la red de apoyo.
            </p>
          </header>

          {cargando && !datos && <EstadoPopover mensaje="Cargando turnos…" />}
          {error && !datos && (
            <EstadoPopover mensaje="No pudimos cargar las notificaciones." tono="error" />
          )}
          {datos && (
            <>
              <Seccion titulo="Hoy" cantidad={datos.hoy.length} conScroll flexible>
                {datos.hoy.length === 0 ? (
                  <p className="text-xs text-gray-500 italic px-1 py-2">
                    No tienes turnos programados para hoy.
                  </p>
                ) : (
                  <ul className="divide-y divide-blue-50">
                    {datos.hoy.map((t) => (
                      <ItemNotificacion key={t.bloqueId} turno={t} />
                    ))}
                  </ul>
                )}
              </Seccion>

              <Seccion titulo="Esta semana" cantidad={datos.semana.length}>
                <button
                  type="button"
                  onClick={() => setSemanaExpandida((v) => !v)}
                  className="w-full flex items-center justify-between px-1 py-1
                             text-xs font-semibold text-blue-700 hover:text-blue-900
                             cursor-pointer rounded-md"
                  aria-expanded={semanaExpandida}
                >
                  <span>{semanaExpandida ? 'Ocultar detalle' : 'Ver detalle'}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${semanaExpandida ? 'rotate-180' : ''}`}
                  />
                </button>
                {semanaExpandida && (
                  <ul className="divide-y divide-blue-50 mt-1">
                    {datos.semana.length === 0 ? (
                      <li className="text-xs text-gray-500 italic px-1 py-2">
                        Sin turnos para los próximos días.
                      </li>
                    ) : (
                      datos.semana.map((t) => (
                        <ItemNotificacion key={t.bloqueId} turno={t} compacto />
                      ))
                    )}
                  </ul>
                )}
              </Seccion>

              <footer className="px-4 py-2 border-t border-blue-100 bg-blue-50/50">
                <p className="text-[10px] text-blue-700/80 text-center">
                  Zona horaria:&nbsp;
                  <span className="font-semibold">America/Guayaquil</span>
                </p>
              </footer>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ============================
// Subcomponentes privados
// ============================

interface SeccionProps {
  titulo: string;
  cantidad: number;
  conScroll?: boolean;
  flexible?: boolean;
  children: React.ReactNode;
}

const Seccion = ({ titulo, cantidad, conScroll = false, flexible = false, children }: SeccionProps) => {
  const clasesContenedorScroll = [
    conScroll ? 'overflow-y-auto -mx-1 px-1' : '',
    flexible ? 'flex-1 min-h-0' : '',
    conScroll && !flexible ? 'max-h-72' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={`px-4 py-3 border-b border-blue-50 last:border-b-0 ${flexible ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      <header className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
          {titulo}
        </h3>
        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
          {cantidad}
        </span>
      </header>
      <div className={clasesContenedorScroll}>{children}</div>
    </section>
  );
};

interface ItemNotificacionProps {
  turno: NotificacionTurno;
  compacto?: boolean;
}

const ItemNotificacion = ({ turno, compacto = false }: ItemNotificacionProps) => {
  const estadoColor = getEstadoColor(turno.estado);
  const padding = compacto ? 'py-2' : 'py-2.5';

  return (
    <li
      className={`${padding} px-1 hover:bg-blue-50/60 rounded-md transition-colors cursor-pointer`}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-2">
        <div className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${estadoColor.dot}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{turno.dependienteNombre}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              {turno.horaInicio} – {turno.horaFin}
            </span>
          </div>
          <div className="mt-1">
            {turno.cuidadorAsignadoNombre ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${estadoColor.badge}`}>
                <User size={10} />
                {turno.cuidadorAsignadoNombre}
              </span>
            ) : (
              <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                Sin asignar
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

interface EstadoPopoverProps {
  mensaje: string;
  tono?: 'info' | 'error';
}
const EstadoPopover = ({ mensaje, tono = 'info' }: EstadoPopoverProps) => (
  <div className="px-4 py-6 text-center">
    <p className={`text-xs ${tono === 'error' ? 'text-red-600' : 'text-gray-500'} italic`}>
      {mensaje}
    </p>
  </div>
);

const getEstadoColor = (estado: NotificacionTurno['estado']) => {
  switch (estado) {
    case 'Completado':
      return { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border border-blue-200' };
    case 'Asignado':
      return { dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700 border border-sky-200' };
    case 'Disponible':
      return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    case 'Cancelado':
      return { dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border border-gray-200' };
  }
};