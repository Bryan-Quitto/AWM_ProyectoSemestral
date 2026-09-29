import useSWR from 'swr';
import { customFetch } from '../../../api/custom-fetch';
import type { RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto } from '../../../api/generated/model';

/**
 * Hook para consumir GET /api/agenda/ultima-bitacora.
 *
 * Retorna la BitacoraTurno más reciente registrada por el usuario autenticado,
 * ordenada por FechaCierre DESC en el backend.
 *
 * Por qué este endpoint y no derivar del listado de bloques:
 *   El orden correcto es por FechaCierre (cuándo se cerró el turno), no por
 *   HoraInicio del bloque (cuándo empezó). Un turno de 08:00 cerrado a las
 *   17:00 debe ganar sobre uno de 09:32 cerrado a las 14:52. Solo el backend
 *   tiene FechaCierre disponible directamente.
 *
 * Reglas:
 *  - Fetch siempre activo (el KPI se muestra en el Dashboard sin interacción).
 *  - 404 → null (el cuidador aún no ha cerrado ningún turno).
 *  - SWR deduplica; `refreshInterval` lo hereda el caller si lo necesita.
 */

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000';

const URL_ULTIMA_BITACORA = `${URL_BASE_API}/api/agenda/ultima-bitacora`;

interface RespuestaEnvoltorio {
  status?: number;
  data?: RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto;
}

const fetcherUltimaBitacora = async (
  url: string,
): Promise<RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | null> => {
  const res = await customFetch<RespuestaEnvoltorio>(url, { method: 'GET' });
  // 404 → el cuidador no tiene bitácoras aún. No es un error de UI.
  if ((res as { status?: number }).status === 404) return null;
  return (res as { data?: RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto }).data ?? null;
};

export interface ResultadoUltimaBitacora {
  bitacora: RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | null;
  isLoading: boolean;
  error: unknown;
  mutate: () => void;
}

export const useUltimaBitacora = (): ResultadoUltimaBitacora => {
  const { data, isLoading, error, mutate } =
    useSWR<RACPDBackendFeaturesAgendaBitacoraTurnoDetalleDto | null>(
      URL_ULTIMA_BITACORA,
      fetcherUltimaBitacora,
      {
        revalidateOnFocus: true,
        dedupingInterval: 10_000,
      },
    );

  return {
    bitacora: data ?? null,
    isLoading,
    error,
    mutate: () => void mutate(),
  };
};
