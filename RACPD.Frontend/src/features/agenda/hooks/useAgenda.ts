import {
  rACPDBackendFeaturesAgendaCrearCrearBloqueEndpoint,
  rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint,
  rACPDBackendFeaturesAgendaEliminarEliminarBloqueEndpoint,
  rACPDBackendFeaturesAgendaReservarReservarEndpoint,
  rACPDBackendFeaturesAgendaCancelarReservaCancelarReservaEndpoint,
} from '../../../api/generated/api/api';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { customFetch } from '../../../api/custom-fetch';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../../api/generated/model';
import type {
  RACPDBackendFeaturesAgendaCrearBloqueRequest,
  RACPDBackendFeaturesAgendaEditarBloqueRequest,
} from '../../../api/generated/model';

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000';

/**
 * Parametros que AgendaDesktop/Mobile pasan al hook para que el BACKEND
 * aplique el filtro (MisBloques/Disponibles/MisReservas/Todos) y la
 * delimitacion de fechas (fechaDesde/fechaHasta).
 *
 * Esto evita depender de usuarioId en el cliente para filtrar y elimina
 * la condicion de carrera donde React pinta tarjetas antes de que el
 * perfil resuelva.
 */
export interface AgendaParams {
  filtro?: 'Todos' | 'Disponibles' | 'MisBloques' | 'MisReservas';
  fechaDesde?: string;
  fechaHasta?: string;
}

const construirUrl = (params: AgendaParams | undefined): string => {
  const qs = new URLSearchParams();
  if (params?.filtro) qs.set('filtro', params.filtro);
  if (params?.fechaDesde) qs.set('fechaDesde', params.fechaDesde);
  if (params?.fechaHasta) qs.set('fechaHasta', params.fechaHasta);
  const tail = qs.toString();
  return tail ? `${URL_BASE_API}/api/agenda?${tail}` : `${URL_BASE_API}/api/agenda`;
};

/**
 * Tipo real de la respuesta tras pasar por customFetch:
 * customFetch anida el body JSON bajo .data y agrega status/headers.
 * A su vez, el backend FastEndpoints envuelve la lista bajo .data.data.
 * Por eso la extraccion final es data.data?.data.
 */
interface RespuestaEnvoltorio {
  data?: {
    data?: RACPDBackendFeaturesAgendaBloqueTurnoDto[];
  };
}

/**
 * Fetcher manual que SI respeta los query params.
 *
 * Importante: NO usamos `useRACPDBackendFeaturesAgendaListarListarBloquesEndpoint`
 * generado por Orval porque su helper `getRACPDBackendFeaturesAgendaListarListarBloquesEndpointUrl`
 * devuelve la URL hardcodeada `/api/agenda` sin params (ver api.ts:1931).
 * Por eso SWR nunca llegaba a mandar `?filtro=MisBloques` al backend.
 */
const fetcherAgenda = async (url: string): Promise<RACPDBackendFeaturesAgendaBloqueTurnoDto[]> => {
  const res = await customFetch<RespuestaEnvoltorio>(url, { method: 'GET' });
  return res?.data?.data ?? [];
};

export const useAgenda = (params?: AgendaParams) => {
  const url = construirUrl(params);
  const { data, error, isLoading, mutate } = useSWR<RACPDBackendFeaturesAgendaBloqueTurnoDto[]>(
    url,
    fetcherAgenda,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    bloques: data ?? [],
    isLoading,
    error,
    mutate,
  };
};

// Hook para crear bloque (POST - sin path params)
export const useCrearBloque = () => {
  return useSWRMutation(
    '/api/agenda',
    async (_: string, { arg }: { arg: RACPDBackendFeaturesAgendaCrearBloqueRequest }) => {
      return rACPDBackendFeaturesAgendaCrearCrearBloqueEndpoint(arg);
    }
  );
};

// Hook para editar bloque (PUT con id en path).
// El caller pasa el objeto plano del formulario más el `id` del bloque.
// El hook desestructura para separar el path segment `id` del body
// (la firma Orval es `editarBloqueEndpoint(id, body)`).
export const useEditarBloque = () => {
  return useSWRMutation(
    '/api/agenda',
    async (
      _: string,
      { arg }: { arg: { id: string } & RACPDBackendFeaturesAgendaEditarBloqueRequest }
    ) => {
      const { id, ...body } = arg;
      return rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint(id, body);
    }
  );
};

// Hook para eliminar bloque (DELETE con id en path)
export const useEliminarBloque = () => {
  return useSWRMutation(
    '/api/agenda',
    async (_: string, { arg }: { arg: string }) => {
      return rACPDBackendFeaturesAgendaEliminarEliminarBloqueEndpoint(arg);
    }
  );
};

// Hook para reservar turno (POST con id en path)
export const useReservarTurno = () => {
  return useSWRMutation(
    '/api/agenda/reservar',
    async (_: string, { arg }: { arg: string }) => {
      return rACPDBackendFeaturesAgendaReservarReservarEndpoint(arg);
    }
  );
};

// Hook para cancelar reserva (DELETE con id en path)
export const useCancelarReserva = () => {
  return useSWRMutation(
    '/api/agenda/reserva',
    async (_: string, { arg }: { arg: string }) => {
      return rACPDBackendFeaturesAgendaCancelarReservaCancelarReservaEndpoint(arg);
    }
  );
};

// Tipos re-exportados
export type { RACPDBackendFeaturesAgendaBloqueTurnoDto };
export type { RACPDBackendFeaturesAgendaCrearBloqueRequest, RACPDBackendFeaturesAgendaEditarBloqueRequest };
