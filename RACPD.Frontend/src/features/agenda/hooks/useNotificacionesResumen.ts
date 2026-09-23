import useSWR from 'swr';
import { customFetch } from '../../../api/custom-fetch';

/**
 * Persona 3 / Semana 2 — Endpoint: GET /api/agenda/notificaciones-resumen.
 *
 * Devuelve el resumen (Hoy + Semana) para alimentar el Popover de la Campana
 * del Navbar. Replicamos el patron de useAgenda: como el hook Orval
 * generado no acepta query params ni personalizacion de URL, escribimos
 * un fetcher manual que SI respeta el endpoint correcto.
 *
 * Configuracion SWR alineada con el principio Zero-Wait (SKILLS.md):
 *   - refreshInterval 60s: la campana se actualiza sin intervencion del usuario.
 *   - revalidateOnFocus: trae resumen fresco al volver a la pestana.
 *   - dedupingInterval 30s: evita llamadas duplicadas en rafagas.
 */

export interface NotificacionTurno {
  bloqueId: string;
  perfilDependienteId: string;
  dependienteNombre: string;
  horaInicio: string;   // "HH:mm"
  horaFin: string;      // "HH:mm"
  cuidadorAsignadoNombre: string | null;
  estado: 'Disponible' | 'Asignado' | 'Cancelado' | 'Completado';
}

export interface NotificacionesResumen {
  hoy: NotificacionTurno[];
  semana: NotificacionTurno[];
}

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000';

const construirUrl = (): string => `${URL_BASE_API}/api/agenda/notificaciones-resumen`;

/**
 * customFetch anida el body JSON bajo .data; FastEndpoints no envuelve
 * el objeto en otro .data (no es una lista), por eso la extraccion es
 * directa a res.data.
 */
interface RespuestaEnvoltorio {
  data?: NotificacionesResumen;
}

const fetcher = async (url: string): Promise<NotificacionesResumen | null> => {
  const res = await customFetch<RespuestaEnvoltorio>(url, { method: 'GET' });
  return res?.data ?? null;
};

export const useNotificacionesResumen = () => {
  const url = construirUrl();
  const { data, error, isLoading, mutate } = useSWR<NotificacionesResumen | null>(
    url,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  return {
    datos: data ?? null,
    isLoading,
    error,
    mutate,
  };
};