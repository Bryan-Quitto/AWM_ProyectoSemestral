import {
  useRACPDBackendFeaturesAgendaListarListarBloquesEndpoint,
  rACPDBackendFeaturesAgendaCrearCrearBloqueEndpoint,
  rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint,
  rACPDBackendFeaturesAgendaEliminarEliminarBloqueEndpoint,
  rACPDBackendFeaturesAgendaReservarReservarEndpoint,
  rACPDBackendFeaturesAgendaCancelarReservaCancelarReservaEndpoint,
} from '../../../api/generated/api/api';
import useSWRMutation from 'swr/mutation';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../../api/generated/model';
import type {
  RACPDBackendFeaturesAgendaCrearBloqueRequest,
  RACPDBackendFeaturesAgendaEditarBloqueRequest,
} from '../../../api/generated/model';

export const useAgenda = () => {
  const { data, error, isLoading, mutate } = useRACPDBackendFeaturesAgendaListarListarBloquesEndpoint({
    swr: {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  });

  return {
    bloques: data?.data?.data ?? [],
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
// Orval firma la mutación con { data: EditarBloqueRequest }; nosotros
// recibimos { id, data } para mayor claridad en el caller.
export const useEditarBloque = () => {
  return useSWRMutation(
    '/api/agenda',
    async (
      _: string,
      { arg }: { arg: { id: string; data: RACPDBackendFeaturesAgendaEditarBloqueRequest } }
    ) => {
      return rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint(arg.id, { data: arg.data });
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
