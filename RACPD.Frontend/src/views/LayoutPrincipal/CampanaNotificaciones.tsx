import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Clock, User } from 'lucide-react';

/**
 * Tipos de dominio para el payload de la Campana.
 *
 * IMPORTANTE (Cero Indulgencia — Semana 1): estos tipos están modelados
 * según el contrato esperado del endpoint
 * `GET /api/agenda/notificaciones-resumen` que se implementará en
 * Semana 2 junto al endpoint `POST /api/agenda/{id}/completar`.
 * Hasta entonces se consumen datos mockeados localmente para que la
 * maqueta sea navegable y verificable visualmente.
 */
export interface NotificacionTurno {
  bloqueTurnoId: string;
  perfilDependienteId: string | null;
  dependienteNombre: string;
  horaInicio: string; // "HH:mm"
  horaFin: string;    // "HH:mm"
  cuidadorAsignadoNombre: string | null;
  estado: 'Disponible' | 'Asignado' | 'Cancelado' | 'Completado';
}

interface CampanaNotificacionesProps {
  /** Tamaño del icono disparador. Desktop suele usar 20, Mobile 24. */
  tamanoIcono?: number;
  /** Alineación del popover respecto al icono. */
  alineacionPopover?: 'izquierda' | 'derecha';
  /** Variante visual: Mobile usa fondo blanco puro sobre header blanco. */
  variante?: 'desktop' | 'mobile';
  /**
   * Identificador del usuario autenticado (sub del JWT). Si es undefined
   * (sesión aún no cargada) NO se muestran notificaciones para evitar
   * filtrar datos de la sesión anterior.
   */
  usuarioId?: string;
  /** Rol del usuario autenticado. Filtra los mocks según corresponda. */
  rolUsuario?: 'CuidadorPrincipal' | 'Apoyo' | 'AdministradorSistema';
}

/**
 * Componente agnóstico que renderiza la Campana de Notificaciones
 * con un Popover ancla. Se reutiliza en el sidebar (Desktop) y en
 * el header superior (Mobile), con misma API.
 *
 * Regla de 3: se usa en 2 lugares y la lógica es idéntica (popover +
 * lista + acordeón). Vale la abstracción.
 *
 * Por ahora muestra datos MOCK hasta que el endpoint real exista en
 * Semana 2. La forma del payload ya respeta el contrato acordado en
 * el spec para evitar retrabajo.
 */
export const CampanaNotificaciones = ({
  tamanoIcono = 20,
  alineacionPopover = 'derecha',
  variante = 'desktop',
  usuarioId,
  rolUsuario,
}: CampanaNotificacionesProps) => {
  const [abierto, setAbierto] = useState(false);
  const [semanaExpandida, setSemanaExpandida] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // TODO Semana 2: reemplazar por useNotificacionesResumen() (SWR) cuando
  // el endpoint exista. Configuración SWR objetivo:
  //   refreshInterval: 60_000,
  //   dedupingInterval: 30_000,
  //   revalidateOnFocus: true,
  //
  // Regla de negocio crítica (visible para no filtrar datos cruzados):
  //   - Apoyo: solo turnos donde el usuario tiene ReservaTurno.Activa=true.
  //   - CuidadorPrincipal: turnos donde es creador o donde su VinculoDependiente
  //     tiene RolEnDependiente=CuidadorPrincipal sobre el PerfilDependiente.
  //   - AdministradorSistema: sin notificaciones operativas (es rol admin).
  // Mientras no exista endpoint, los mocks se filtran por estas reglas para
  // que dos usuarios distintos NO vean los mismos datos.
  const { datosMock, cargando, error } = useNotificacionesResumenMock(
    usuarioId,
    rolUsuario,
  );

  // Click-outside para cerrar el popover.
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
    () => (datosMock?.hoy.length ?? 0) + (datosMock?.semana.length ?? 0),
    [datosMock],
  );

  // Colores coherentes con el tema azul/celeste/blanco del proyecto.
  const clasesBoton =
    variante === 'mobile'
      ? 'p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors cursor-pointer active:scale-95'
      : 'p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors cursor-pointer active:scale-95';

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
          {/* Encabezado */}
          <header className="px-4 py-3 bg-gradient-to-r from-sky-600 to-blue-500 text-white">
            <div className="flex items-center gap-2">
              <Bell size={16} />
              <h2 className="font-bold text-sm uppercase tracking-wide">Notificaciones</h2>
            </div>
            <p className="text-xs text-sky-50/90 mt-0.5">
              Resumen de tus turnos en la red de apoyo.
            </p>
          </header>

          {cargando && <EstadoPopover mensaje="Cargando turnos…" />}
          {error && <EstadoPopover mensaje="No pudimos cargar las notificaciones." tono="error" />}
          {!cargando && !error && datosMock && (
            <>
              {/* Sección HOY */}
              <Seccion
                titulo="Hoy"
                cantidad={datosMock.hoy.length}
                conScroll
                flexible
              >
                {datosMock.hoy.length === 0 ? (
                  <p className="text-xs text-gray-500 italic px-1 py-2">
                    No tienes turnos programados para hoy.
                  </p>
                ) : (
                  <ul className="divide-y divide-blue-50">
                    {datosMock.hoy.map((t) => (
                      <ItemNotificacion key={t.bloqueTurnoId} turno={t} />
                    ))}
                  </ul>
                )}
              </Seccion>

              {/* Sección SEMANA (acordeón colapsado por defecto) */}
              <Seccion titulo="Esta semana" cantidad={datosMock.semana.length}>
                <button
                  type="button"
                  onClick={() => setSemanaExpandida((v) => !v)}
                  className="w-full flex items-center justify-between px-1 py-1
                             text-xs font-semibold text-blue-700 hover:text-blue-900
                             cursor-pointer rounded-md"
                  aria-expanded={semanaExpandida}
                >
                  <span>
                    {semanaExpandida ? 'Ocultar detalle' : 'Ver detalle'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${semanaExpandida ? 'rotate-180' : ''}`}
                  />
                </button>
                {semanaExpandida && (
                  <ul className="divide-y divide-blue-50 mt-1">
                    {datosMock.semana.length === 0 ? (
                      <li className="text-xs text-gray-500 italic px-1 py-2">
                        Sin turnos para los próximos días.
                      </li>
                    ) : (
                      datosMock.semana.map((t) => (
                        <ItemNotificacion key={t.bloqueTurnoId} turno={t} compacto />
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
        <span
          className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full"
        >
          {cantidad}
        </span>
      </header>
      <div className={clasesContenedorScroll}>
        {children}
      </div>
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
        <div
          className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${estadoColor.dot}`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {turno.dependienteNombre}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              {turno.horaInicio} – {turno.horaFin}
            </span>
          </div>
          <div className="mt-1">
            {turno.cuidadorAsignadoNombre ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${estadoColor.badge}`}
              >
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
    <p
      className={`text-xs ${tono === 'error' ? 'text-red-600' : 'text-gray-500'} italic`}
    >
      {mensaje}
    </p>
  </div>
);

// ============================
// Utilidades de estilo
// ============================

const getEstadoColor = (estado: NotificacionTurno['estado']) => {
  switch (estado) {
    case 'Completado':
      return {
        dot: 'bg-blue-500',
        badge: 'bg-blue-50 text-blue-700 border border-blue-200',
      };
    case 'Asignado':
      return {
        dot: 'bg-sky-500',
        badge: 'bg-sky-50 text-sky-700 border border-sky-200',
      };
    case 'Disponible':
      return {
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      };
    case 'Cancelado':
      return {
        dot: 'bg-gray-400',
        badge: 'bg-gray-50 text-gray-600 border border-gray-200',
      };
  }
};

// ============================
// Datos mock (SOLO Semana 1)
// ============================

/**
 * Tipos internos del mock: extienden la forma pública con el dueño
 * del turno (necesario para filtrar por usuario actual sin filtrar
 * datos cruzados entre sesiones).
 */
interface NotificacionTurnoMock extends NotificacionTurno {
  /** UsuarioId del cuidador asignado (Apoyo que tomó el cupo). */
  usuarioAsignadoId: string | null;
  /** UsuarioId del creador del bloque (Cuidador Principal del dependiente). */
  creadoPorId: string;
}

/**
 * Dataset simulado. Cada turno declara explícitamente a quién
 * pertenece. En Semana 2 este set será reemplazado por una consulta
 * al endpoint real.
 */
const MOCK_TURNOS: NotificacionTurnoMock[] = [
  // Turnos de María Pérez (perfil mock-perf-1) — creados por "principal-demo"
  {
    bloqueTurnoId: 'mock-1',
    perfilDependienteId: 'mock-perf-1',
    dependienteNombre: 'María Pérez',
    horaInicio: '08:00',
    horaFin: '14:00',
    cuidadorAsignadoNombre: 'Juan López',
    estado: 'Asignado',
    usuarioAsignadoId: 'user-apoyo-juan',
    creadoPorId: 'user-principal-demo',
  },
  {
    bloqueTurnoId: 'mock-3',
    perfilDependienteId: 'mock-perf-1',
    dependienteNombre: 'María Pérez',
    horaInicio: '20:00',
    horaFin: '02:00',
    cuidadorAsignadoNombre: 'Ana Ortiz',
    estado: 'Completado',
    usuarioAsignadoId: 'user-apoyo-ana',
    creadoPorId: 'user-principal-demo',
  },
  {
    bloqueTurnoId: 'mock-w1',
    perfilDependienteId: 'mock-perf-1',
    dependienteNombre: 'María Pérez',
    horaInicio: '08:00',
    horaFin: '14:00',
    cuidadorAsignadoNombre: 'Juan López',
    estado: 'Asignado',
    usuarioAsignadoId: 'user-apoyo-juan',
    creadoPorId: 'user-principal-demo',
  },
  {
    bloqueTurnoId: 'mock-w3',
    perfilDependienteId: 'mock-perf-1',
    dependienteNombre: 'María Pérez',
    horaInicio: '08:00',
    horaFin: '14:00',
    cuidadorAsignadoNombre: 'Ana Ortiz',
    estado: 'Asignado',
    usuarioAsignadoId: 'user-apoyo-ana',
    creadoPorId: 'user-principal-demo',
  },

  // Turnos de Carlos Méndez (perfil mock-perf-2) — creados por OTRO principal
  {
    bloqueTurnoId: 'mock-2',
    perfilDependienteId: 'mock-perf-2',
    dependienteNombre: 'Carlos Méndez',
    horaInicio: '14:00',
    horaFin: '20:00',
    cuidadorAsignadoNombre: null,
    estado: 'Disponible',
    usuarioAsignadoId: null,
    creadoPorId: 'user-principal-otro',
  },
  {
    bloqueTurnoId: 'mock-w2',
    perfilDependienteId: 'mock-perf-2',
    dependienteNombre: 'Carlos Méndez',
    horaInicio: '14:00',
    horaFin: '20:00',
    cuidadorAsignadoNombre: null,
    estado: 'Disponible',
    usuarioAsignadoId: null,
    creadoPorId: 'user-principal-otro',
  },
];

/**
 * Hook temporal que devuelve datos de ejemplo para que la maqueta
 * sea navegable. Será eliminado en Semana 2 al reemplazar por SWR.
 *
 * REGLAS DE FILTRADO (alineadas con la spec):
 *  - Apoyo: ve solo turnos donde usuarioAsignadoId === usuarioId.
 *  - CuidadorPrincipal: ve solo turnos donde creadoPorId === usuarioId.
 *  - AdministradorSistema: array vacío (no tiene notificaciones operativas).
 *  - Sin usuarioId / sin rol: array vacío (estado honesto, evita filtrar
 *    datos de la sesión anterior mientras se carga la sesión actual).
 */
function useNotificacionesResumenMock(
  usuarioId?: string,
  rolUsuario?: 'CuidadorPrincipal' | 'Apoyo' | 'AdministradorSistema',
) {
  const filtrados = useMemo<NotificacionTurnoMock[]>(() => {
    // Sin sesión aún: no devolver nada (no leak entre sesiones).
    if (!usuarioId || !rolUsuario) return [];

    if (rolUsuario === 'Apoyo') {
      return MOCK_TURNOS.filter((t) => t.usuarioAsignadoId === usuarioId);
    }
    if (rolUsuario === 'CuidadorPrincipal') {
      return MOCK_TURNOS.filter((t) => t.creadoPorId === usuarioId);
    }
    // AdministradorSistema: sin notificaciones operativas.
    return [];
  }, [usuarioId, rolUsuario]);

  // Para Semana 1 los 3 ítems de "Hoy" son los mismos 3 primeros; el resto
  // va a "Semana". Esto es solo un seed visual. La división real la hará
  // el backend por rango de fechas en TZ America/Guayaquil.
  const datosMock = useMemo(() => {
    const publicShape = filtrados.map(({ usuarioAsignadoId: _u, creadoPorId: _c, ...resto }) => resto);

    return {
      // Split arbitrario 50/50 entre hoy y semana SOLO para mantener
      // la maqueta visual. En Semana 2 esto lo decide el backend.
      hoy: publicShape.slice(0, Math.ceil(publicShape.length / 2)),
      semana: publicShape.slice(Math.ceil(publicShape.length / 2)),
    };
  }, [filtrados]);

  // "Cargando" SOLO mientras esperamos que el padre nos pase la sesión.
  // Cuando ya tenemos usuarioId + rolUsuario (aunque no haya matches),
  // el estado correcto es "no hay notificaciones" — NO "cargando".
  const sesionLista = Boolean(usuarioId && rolUsuario);

  return {
    datosMock: sesionLista ? datosMock : null,
    cargando: !sesionLista,
    error: false,
  };
}