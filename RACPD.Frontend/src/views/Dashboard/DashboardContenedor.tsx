import { useState, useMemo } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNotificacionesResumen } from '../../features/agenda/hooks/useNotificacionesResumen';
import { useDirectorioRelevos } from '../../features/directorio-relevos/hooks/useDirectorioRelevos';
import { useUltimaBitacora } from '../../features/agenda/hooks/useUltimaBitacora';
import {
  useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint,
  useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint,
  useRACPDBackendFeaturesUsuariosAdministracionListarUsuariosListarUsuariosEndpoint,
} from '../../api/generated/api/api';
import { DashboardDesktop } from './DashboardDesktop';
import { DashboardMobile } from './DashboardMobile';
import { DashboardAdmin } from './DashboardAdmin';
import { ModalDetalleBitacoraDashboard } from './ModalDetalleBitacoraDashboard';
import type { NotificacionTurno } from '../../features/agenda/hooks/useNotificacionesResumen';

/**
 * Convierte "HH:mm" a minutos desde 00:00. Defensivo ante strings vacíos.
 */
const parsearHHmm = (hhmm: string | undefined): number => {
  if (!hhmm || typeof hhmm !== 'string') return -1;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
};

/**
 * Parsea string YYYY-MM-DD sin desfasar la zona horaria (año, mes, día exactos).
 */
const parsearFechaLocal = (yyyyMmDd: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
};

const capitalizar = (texto: string): string =>
  texto.charAt(0).toUpperCase() + texto.slice(1);

const formatearFechaCorta = (d: Date): string =>
  capitalizar(
    d.toLocaleDateString('es-EC', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }),
  );

/**
 * Obtiene el rango de la semana calendario (Lunes a Domingo) que contiene a la fecha base.
 */
const obtenerLimitesSemanaCalendario = (fechaBase: Date): { lunes: Date; domingo: Date; lunesStr: string; domingoStr: string } => {
  const d = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
  const diaSemana = d.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  // Diferencia de días hasta el lunes anterior/actual: si es Domingo (0), restamos 6 días.
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diffLunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, '0');
  const aStr = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return {
    lunes,
    domingo,
    lunesStr: aStr(lunes),
    domingoStr: aStr(domingo),
  };
};

export type TipoEstadoTemporalTurno = 'en-curso' | 'proximo' | 'concluidos';

export interface TurnoRelevanteHoy {
  turno: NotificacionTurno;
  tipo: 'en-curso' | 'proximo';
}

/**
 * Determina el turno relevante del día según la hora actual:
 * 1. Filtra los turnos de hoy que NO estén completados (con bitácora ya cerrada).
 * 2. Si hay un turno no completado cuyo intervalo [inicio, fin] contiene la hora actual -> 'en-curso'.
 * 3. Si no hay ninguno en curso, busca el primer turno no completado futuro de hoy (ahora < fin) -> 'proximo'.
 * 4. Si todos los turnos de hoy ya terminaron o están completados -> retorna null con todosConcluidos: true.
 */
const calcularTurnoRelevanteHoy = (
  hoy: NotificacionTurno[],
): { resultado: TurnoRelevanteHoy | null; todosConcluidos: boolean } => {
  if (!hoy.length) return { resultado: null, todosConcluidos: false };

  const ahora = new Date();
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

  // Ignoramos turnos que ya fueron cerrados con bitácora
  const turnosActivos = hoy.filter((t) => t.estado !== 'Completado');

  // Si había turnos pero todos ya fueron cerrados con bitácora, la jornada está concluida
  if (turnosActivos.length === 0) {
    return { resultado: null, todosConcluidos: true };
  }

  // 1. ¿Hay algún turno activo ocurriendo en este momento exacto?
  const enCurso = turnosActivos.find((t) => {
    const inicio = parsearHHmm(t.horaInicio);
    const fin = parsearHHmm(t.horaFin);
    return inicio >= 0 && fin >= 0 && inicio <= minutosActuales && minutosActuales <= fin;
  });

  if (enCurso) {
    return { resultado: { turno: enCurso, tipo: 'en-curso' }, todosConcluidos: false };
  }

  // 2. ¿Hay algún turno activo futuro que aún no haya concluido hoy?
  const proximo = turnosActivos.find((t) => {
    const fin = parsearHHmm(t.horaFin);
    return fin >= 0 && minutosActuales < fin;
  });

  if (proximo) {
    return { resultado: { turno: proximo, tipo: 'proximo' }, todosConcluidos: false };
  }

  // 3. Si no hay ninguno en curso ni futuro entre los activos, todos los turnos de hoy concluyeron
  return { resultado: null, todosConcluidos: true };
};

/**
 * DashboardContenedor
 *
 * Composición de hooks + derivación de KPIs. Bifurca entre Desktop y Mobile.
 *
 * Decisiones de diseño:
 * - Sin estado local persistente: todos los KPIs son expresiones puras sobre
 *   los datos cacheados por SWR (regla React 19: no usar useEffect para
 *   sincronizar SWR).
 * - Carga única: usa los mismos hooks que ya consume CampanaNotificaciones
 *   y DirectorioRelevos → SWR deduplica automáticamente las keys.
 * - Sin polling propio: refreshInterval viene del hook existente.
 */
export const DashboardContenedor = () => {
  const esMobile = useMediaQuery('(max-width: 768px)');

  // === Hooks SWR ===
  const {
    datos,
    isLoading: cargandoNotificaciones,
    error: errorNotificaciones,
    mutate: reintentarNotificaciones,
  } = useNotificacionesResumen();

  const {
    relevos: relevosDisponibles,
    isLoading: cargandoRelevos,
    error: errorRelevos,
    mutate: reintentarRelevos,
  } = useDirectorioRelevos({
    estado: 'Disponible',
    perfilDependienteId: undefined,
  });

  const { data: misDependientesData } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();

  const { data: miPerfilData } =
    useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint();

  // === Estado derivado ===
  const dependienteActivo = useMemo(() => {
    const lista = misDependientesData?.data;
    if (!Array.isArray(lista)) return null;
    const primerPrincipal = lista.find((p) => p.rolEnDependiente === 'CuidadorPrincipal');
    return primerPrincipal ?? lista[0] ?? null;
  }, [misDependientesData]);

  const nombreDependiente = dependienteActivo?.nombreCompleto ?? '';
  const nombreCuidador =
    [miPerfilData?.data?.nombre, miPerfilData?.data?.apellido]
      .filter(Boolean)
      .join(' ')
      .trim() || '';

  const turnosHoy = useMemo(() => datos?.hoy ?? [], [datos]);
  const turnosSemana = useMemo(() => datos?.semana ?? [], [datos]);

  const { resultado: turnoRelevante, todosConcluidos: turnosHoyConcluidos } = useMemo(
    () => calcularTurnoRelevanteHoy(turnosHoy),
    // turnosHoy es memoizado por dato → solo cambia cuando SWR recibe respuesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos],
  );

  const kpiTurnosHoy = useMemo(() => {
    const total = turnosHoy.length;
    // Un turno se considera "cubierto" solo si tiene estado Asignado (reserva
    // activa real). Esto excluye los bloques propios sin reserva, que el
    // backend etiqueta con cuidadorAsignadoNombre='Yo' pero estado='Disponible'.
    const cubiertos = turnosHoy.filter((t) => t.estado === 'Asignado').length;
    return { total, cubiertos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  const kpiCoberturaSemanal = useMemo(() => {
    // Cobertura semanal: delimitada a la semana calendario natural en curso (Lunes a Domingo).
    // Esto lo diferencia deliberadamente del Radar de la Semana (que es una ventana deslizante de 7 días).
    const fechaAncla = turnosHoy[0]?.fecha ? parsearFechaLocal(turnosHoy[0].fecha) ?? new Date() : new Date();
    const { lunes, domingo, lunesStr, domingoStr } = obtenerLimitesSemanaCalendario(fechaAncla);

    // Filtramos los turnos de la semana dentro de la semana natural [lunes, domingo]
    const turnosEnSemanaCalendario = turnosSemana.filter(
      (t) => t.fecha >= lunesStr && t.fecha <= domingoStr,
    );

    // Cubiertos = turnos con cuidador asignado en los días restantes de la semana actual
    const cubiertos = turnosEnSemanaCalendario.filter((t) => t.estado === 'Asignado').length;

    // Pendientes = turnos por cubrir en la semana calendario (hoy + días restantes de la semana actual)
    const turnosHoyEnSemana = turnosHoy.filter((t) => t.fecha >= lunesStr && t.fecha <= domingoStr);
    const pendientes = [...turnosHoyEnSemana, ...turnosEnSemanaCalendario].filter(
      (t) => t.estado === 'Disponible',
    ).length;

    const rango = `${formatearFechaCorta(lunes)} - ${formatearFechaCorta(domingo)}`;

    return { cubiertos, pendientes, rango };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  // useUltimaBitacora llama a GET /api/agenda/ultima-bitacora que ordena por
  // FechaCierre DESC en el backend — la única fuente de verdad correcta.
  // Elimina la dependencia frágil de ordenar BloquesTurno por horaInicio en el cliente
  // (que era el bug: turno de 08:00 cerrado a las 17:00 quedaba tapado por uno de
  // 09:32 cerrado antes a las 14:52 porque "09:32" > "08:00" lexicográficamente).
  const {
    bitacora: ultimaBitacora,
    isLoading: cargandoBitacora,
    error: errorBitacora,
    mutate: recargarBitacoraMutate,
  } = useUltimaBitacora();

  // El bloqueId de la última bitácora se usa para el deep-link al modal de agenda
  const ultimoBloqueCompletadoId = ultimaBitacora?.bloqueTurnoId ?? undefined;


  const kpiEstadoAnimo = useMemo(() => {
    if (!ultimoBloqueCompletadoId) {
      return {
        valor: 'Sin registros',
        subtexto: 'Aún no hay bitácoras cerradas',
        icono: 'neutral' as const,
        tono: 'primario' as const,
      };
    }
    const animo = ultimaBitacora?.estadoAnimo;
    if (!animo) {
      return {
        valor: 'Registrado',
        subtexto: 'Turno cerrado recientemente',
        icono: 'bueno' as const,
        tono: 'exito' as const,
      };
    }

    switch (animo) {
      case 'MuyBien':
        return {
          valor: 'Muy bien 😊',
          subtexto: ultimaBitacora.sintomas ? `Síntoma: ${ultimaBitacora.sintomas}` : 'Sin síntomas reportados',
          icono: 'excelente' as const,
          tono: 'exito' as const,
        };
      case 'Bien':
        return {
          valor: 'Bien 🙂',
          subtexto: ultimaBitacora.sintomas ? `Síntoma: ${ultimaBitacora.sintomas}` : 'Evolución favorable',
          icono: 'bueno' as const,
          tono: 'exito' as const,
        };
      case 'Neutral':
        return {
          valor: 'Estable 😐',
          subtexto: ultimaBitacora.sintomas ? `Síntoma: ${ultimaBitacora.sintomas}` : 'Sin cambios relevantes',
          icono: 'neutral' as const,
          tono: 'primario' as const,
        };
      case 'Mal':
        return {
          valor: 'Atención ⚠️',
          subtexto: ultimaBitacora.sintomas ? `Síntoma: ${ultimaBitacora.sintomas}` : 'Malestar reportado',
          icono: 'alerta' as const,
          tono: 'alerta' as const,
        };
      case 'MuyMal':
        return {
          valor: 'Crítico 🚨',
          subtexto: ultimaBitacora.sintomas ? `Síntoma: ${ultimaBitacora.sintomas}` : 'Requiere supervisión',
          icono: 'critico' as const,
          tono: 'alerta' as const,
        };
      default:
        return {
          valor: animo,
          subtexto: 'Última observación registrada',
          icono: 'neutral' as const,
          tono: 'primario' as const,
        };
    }
  }, [ultimoBloqueCompletadoId, ultimaBitacora]);

  const cuidadoresDisponibles = relevosDisponibles.length;

  const [modalBitacoraAbierto, setModalBitacoraAbierto] = useState(false);

  const propsCompartidas = {
    nombreCuidador,
    kpiTurnosHoy,
    kpiCoberturaSemanal,
    cuidadoresDisponibles,
    kpiEstadoAnimo,
    cargandoNotificaciones,
    cargandoRelevos,
    cargandoEstadoAnimo: cargandoBitacora,
    hayErrorNotificaciones: Boolean(errorNotificaciones),
    hayErrorRelevos: Boolean(errorRelevos),
    reintentarNotificaciones: () => {
      void reintentarNotificaciones();
    },
    reintentarRelevos: () => {
      void reintentarRelevos();
    },
    turnoRelevante,
    turnosHoyConcluidos,
    turnosHoy,
    turnosSemana,
    onAbrirBitacora: ultimoBloqueCompletadoId ? () => setModalBitacoraAbierto(true) : undefined,
  };

  const esAdministrador = miPerfilData?.data?.rol === 'AdministradorSistema';

  // Si el usuario es Administrador del Sistema, solo consultamos la administración de usuarios
  const { data: usuariosData, isLoading: cargandoUsuarios } =
    useRACPDBackendFeaturesUsuariosAdministracionListarUsuariosListarUsuariosEndpoint({
      swr: {
        enabled: esAdministrador,
      },
    });

  const kpisAdmin = useMemo(() => {
    if (!esAdministrador || !usuariosData?.data) {
      return { total: 0, activos: 0, inactivos: 0 };
    }
    const lista = Array.isArray(usuariosData.data) ? usuariosData.data : [];
    const total = lista.length;
    const activos = lista.filter((u) => u.estado === 'Activo').length;
    const inactivos = lista.filter((u) => u.estado === 'Desactivado').length;
    return { total, activos, inactivos };
  }, [esAdministrador, usuariosData]);

  if (esAdministrador) {
    return (
      <DashboardAdmin
        totalUsuarios={kpisAdmin.total}
        usuariosActivos={kpisAdmin.activos}
        usuariosInactivos={kpisAdmin.inactivos}
        cargando={cargandoUsuarios}
        nombreAdmin={nombreCuidador}
      />
    );
  }

  return (
    <>
      {esMobile ? (
        <DashboardMobile {...propsCompartidas} />
      ) : (
        <DashboardDesktop {...propsCompartidas} />
      )}

      <ModalDetalleBitacoraDashboard
        abierto={modalBitacoraAbierto}
        onCerrar={() => setModalBitacoraAbierto(false)}
        bitacora={ultimaBitacora}
        cargando={cargandoBitacora}
        error={errorBitacora}
        onReintentar={() => recargarBitacoraMutate()}
        bloqueId={ultimoBloqueCompletadoId}
        nombreDependiente={nombreDependiente}
        dependienteId={dependienteActivo?.perfilId}
      />
    </>
  );
};
