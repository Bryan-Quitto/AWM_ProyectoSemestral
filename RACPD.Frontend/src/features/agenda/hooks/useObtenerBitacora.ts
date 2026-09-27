import {
  useRACPDBackendFeaturesAgendaObtenerBitacoraObtenerBitacoraEndpoint,
} from '../../../api/generated/api/api';
import type { RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto } from '../../../api/generated/model';

/**
 * Persona 3 / Semana 3 — Hook para consumir GET /api/agenda/{id}/bitacora.
 *
 * Devuelve la BitacoraTurno activa del bloque (ánimo, síntomas, horas de
 * sueño, observaciones, registrador y checklist realizado vs pendiente) para
 * que el relevo entrante y el cuidador principal puedan revisar el reporte
 * clínico/operativo del turno anterior.
 *
 * Reglas:
 *  - El fetch se lanza SOLO si `bloqueId` está presente y `modalAbierto`
 *    es true (SWR condicional). Así evitamos golpear el backend cuando
 *    el cuidador no abrió el modal de lectura.
 *  - Usa el hook Orval generado (SSoT de tipos). Si el endpoint cambiara,
 *    basta con ejecutar `npm run api:generate`.
 *
 * Errores:
 *  - 401/403: el cuidador no tiene visibilidad sobre el bloque.
 *  - 404: el turno aún no fue cerrado.
 *  - 400: id mal formado.
 * El hook expone `error` para que la UI lo muestre de forma contextual.
 */

export interface ParametrosObtenerBitacora {
  /** Id del BloqueTurno maestro. */
  bloqueId?: string;
  /** Solo consultamos cuando el modal está abierto (zero-wait). */
  modalAbierto: boolean;
}

export interface ResultadoObtenerBitacora {
  bitacora: RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

export const useObtenerBitacora = ({
  bloqueId,
  modalAbierto,
}: ParametrosObtenerBitacora): ResultadoObtenerBitacora => {
  // El hook Orval generado implementa SWR internamente y soporta `enabled`
  // para condicionar el fetch. Lo usamos directo: una sola suscripción,
  // sin doble useSWR encima.
  const habilitado = Boolean(bloqueId) && modalAbierto;

  const resultado = useRACPDBackendFeaturesAgendaObtenerBitacoraObtenerBitacoraEndpoint(
    bloqueId ?? '',
    {
      swr: {
        enabled: habilitado,
        // No revalidar en cada focus: el cuidador abre el modal, lee y cierra.
        // Si lo reabre, la clave cambia y SWR hace fetch fresco (cacheado o no).
        revalidateOnFocus: false,
        dedupingInterval: 5_000,
      },
    },
  );

  // Narrowing: el hook Orval devuelve Success (status 200) o Error (401/403/404).
  // En Success expone `data.data` con el DTO; en Error, `data.data` es void.
  const respuesta = resultado.data as
    | { status: number; data: RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | void }
    | undefined;

  const esExitoso = respuesta?.status === 200;
  const bitacora = esExitoso
    ? (respuesta?.data as RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | undefined) ?? null
    : null;

  return {
    bitacora,
    isLoading: resultado.isLoading && habilitado,
    error: resultado.error,
    refetch: () => {
      void resultado.mutate();
    },
  };
};