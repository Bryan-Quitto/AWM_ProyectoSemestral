import { useMemo } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNotificacionesResumen } from '../../features/agenda/hooks/useNotificacionesResumen';
import { useDirectorioRelevos } from '../../features/directorio-relevos/hooks/useDirectorioRelevos';
import { useAgenda } from '../../features/agenda/hooks/useAgenda';
import { useObtenerBitacora } from '../../features/agenda/hooks/useObtenerBitacora';
import {
  useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint,
  useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint,
  useRACPDBackendFeaturesUsuariosAdministracionListarUsuariosListarUsuariosEndpoint,
} from '../../api/generated/api/api';
import { DashboardDesktop } from './DashboardDesktop';
import { DashboardMobile } from './DashboardMobile';
import { DashboardAdmin } from './DashboardAdmin';
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
 * Determina el "turno en curso": el primer bloque de HOY cuyo intervalo
 * [inicio, fin] contiene la hora actual del cliente. Si no hay ninguno,
 * retorna el primero del día (próximo por ocurrir) o null.
 *
 * Nota de zona horaria (SPEC §2): el backend serializa en America/Guayaquil
 * pero el navegador usa su zona local. Riesgo aceptado para MVP; documentado
 * como mejora futura (inyectar `Date.now()` desde el backend).
 */
const calcularTurnoEnCurso = (hoy: NotificacionTurno[]): NotificacionTurno | null => {
  if (!hoy.length) return null;
  const ahora = new Date();
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

  const enCurso = hoy.find((t) => {
    const inicio = parsearHHmm(t.horaInicio);
    const fin = parsearHHmm(t.horaFin);
    return inicio >= 0 && fin >= 0 && inicio <= minutosActuales && minutosActuales <= fin;
  });

  return enCurso ?? hoy[0] ?? null;
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

  const turnoEnCurso = useMemo(
    () => calcularTurnoEnCurso(turnosHoy),
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
    // Cobertura semanal = bloque cubierto (Asignado) en la semana actual
    // excluyendo los de hoy (que ya se cuentan en el KPI "Turnos de hoy").
    // Pendientes = bloques visibles (hoy + semana) SIN reserva activa.
    // IMPORTANTE: usamos `estado === 'Disponible'` como único criterio de
    // "pendiente". El campo `cuidadorAsignadoNombre` no es fiable porque el
    // backend lo setea a "Yo" cuando el cuidador principal crea el bloque
    // (aunque NO haya reserva activa). El estado es la fuente de verdad.
    const cubiertos = turnosSemana.filter((t) => t.estado === 'Asignado').length;
    const pendientes = [...turnosHoy, ...turnosSemana].filter(
      (t) => t.estado === 'Disponible',
    ).length;
    return { cubiertos, pendientes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  // Consultamos los bloques para ubicar el último turno que fue completado con bitácora
  const { bloques, isLoading: cargandoAgenda } = useAgenda();

  const ultimoBloqueCompletadoId = useMemo(() => {
    if (!bloques || !bloques.length) return undefined;
    const completados = bloques.filter((b) => b.estaCompletado && b.id);
    if (!completados.length) return undefined;
    // Ordenar de más reciente a más antiguo por fecha y hora
    const ordenados = [...completados].sort((a, b) => {
      const fechaA = `${a.fecha ?? ''} ${a.horaInicio ?? ''}`;
      const fechaB = `${b.fecha ?? ''} ${b.horaInicio ?? ''}`;
      return fechaB.localeCompare(fechaA);
    });
    return ordenados[0]?.id;
  }, [bloques]);

  const { bitacora: ultimaBitacora, isLoading: cargandoBitacora } = useObtenerBitacora({
    bloqueId: ultimoBloqueCompletadoId,
    modalAbierto: Boolean(ultimoBloqueCompletadoId),
  });

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

  const propsCompartidas = {
    nombreCuidador,
    nombreDependiente,
    kpiTurnosHoy,
    kpiCoberturaSemanal,
    cuidadoresDisponibles,
    kpiEstadoAnimo,
    cargandoNotificaciones,
    cargandoRelevos,
    cargandoEstadoAnimo: cargandoAgenda || cargandoBitacora,
    hayErrorNotificaciones: Boolean(errorNotificaciones),
    hayErrorRelevos: Boolean(errorRelevos),
    reintentarNotificaciones: () => {
      void reintentarNotificaciones();
    },
    reintentarRelevos: () => {
      void reintentarRelevos();
    },
    turnoEnCurso,
    turnosHoy,
    turnosSemana,
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

  return esMobile ? (
    <DashboardMobile {...propsCompartidas} />
  ) : (
    <DashboardDesktop {...propsCompartidas} />
  );
};
