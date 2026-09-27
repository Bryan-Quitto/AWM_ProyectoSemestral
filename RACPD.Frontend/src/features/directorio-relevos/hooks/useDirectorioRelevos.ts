import {
  useRACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpoint,
} from '../../../api/generated/api/api';
import useSWRMutation from 'swr/mutation';
import { customFetch } from '../../../api/custom-fetch';
import type {
  RACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpointParams,
  RACPDBackendFeaturesDirectorioRelevosListarRelevoItemResponse,
  RACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoRequest,
  RACPDBackendFeaturesDirectorioRelevosCrearRelevoItemResponse,
} from '../../../api/generated/model';

/**
 * Body para crear un relevo (POST /api/directorio-relevos).
 * Réplica 1:1 del DTO backend `CrearRelevoRequest`. Reexportado para
 * que los componentes (DialogoRelevo) no importen paths largos.
 */
export type CrearRelevoBody = RACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoRequest;

/**
 * Shape de la respuesta cruda de `customFetch` para los hooks de
 * mutación. El wrapper devuelve `{ data, status, headers }`, así
 * nuestros hooks pueden inspeccionar `status` sin `as any`.
 */
interface CustomFetchResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Hook de datos para el Directorio de Relevos.
 *
 * Encapsula el SWR generado por Orval y aplica la política Zero-Wait:
 * - dedupingInterval de 30s para evitar refetchs en cada keystroke.
 * - keepPreviousData para que la UI no parpadee al cambiar filtros.
 * - revalidateOnFocus para mantener datos frescos al volver a la pestaña.
 *
 * Devuelve un array normalizado con fallback `[]` defensivo, siguiendo
 * la regla del proyecto (GOTCHA CS1736 en backend → ?? [] en frontend).
 */
export const useDirectorioRelevos = (
  params: RACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpointParams,
) => {
  const { data, error, isLoading, mutate } =
    useRACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpoint(
      params,
      {
        swr: {
          revalidateOnFocus: true,
          dedupingInterval: 30_000,
          keepPreviousData: true,
        },
      },
    );

  // Narrowing: la respuesta Orval es `Success | Error`, donde `Error.data`
  // es `void`. Solo accedemos al array si la respuesta es satisfactoria
  // (status === 200 y data no es void). En cualquier otro caso (loading,
  // 401/403/404), devolvemos [].
  const relevos: RACPDBackendFeaturesDirectorioRelevosListarRelevoItemResponse[] =
    data?.status === 200 && Array.isArray(data.data) ? data.data : [];

  return {
    relevos,
    isLoading,
    error,
    mutate,
  };
};

/**
 * Hook de mutación para crear un relevo.
 *
 * Usa el hook SWR generado por Orval (regenerado con el nuevo endpoint).
 * Coherente con el patrón del proyecto: ningún `customFetch` directo en
 * features (SKILLS.md: "Todo consumo HTTP debe hacerse mediante los hooks
 * autogenerados por Orval").
 */
export const useCrearRelevo = () => {
  return useSWRMutation(
    '/api/directorio-relevos',
    async (
      _: string,
      { arg }: { arg: RACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoRequest },
    ) => {
      const { rACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoEndpoint } = await import(
        '../../../api/generated/api/api'
      );
      return rACPDBackendFeaturesDirectorioRelevosCrearCrearRelevoEndpoint(arg);
    },
  );
};

/**
 * Tipo de respuesta del POST /api/directorio-relevos.
 */
export type CrearRelevoResponse = RACPDBackendFeaturesDirectorioRelevosCrearRelevoItemResponse;

/**
 * Body para editar un relevo (PUT /api/directorio-relevos/{id}).
 * Coincide 1:1 con el DTO backend `EditarRelevoRequest`. Todos los campos
 * son opcionales (PATCH-like semantics sobre PUT): solo se aplican los
 * que se envían.
 */
export interface EditarRelevoBody {
  nombre?: string;
  telefono?: string;
  estado?: 'Disponible' | 'NoDisponible';
  /** Vacío = limpiar; null/undefined = no tocar. */
  notas?: string | null;
  listado?: boolean;
}

/**
 * Hook de mutación para editar un relevo.
 *
 * Usa `customFetch` directo (no el hook nativo de Orval) porque el
 * endpoint `PUT /api/directorio-relevos/{id}` aún no está en el código
 * generado. Cuando se regenere Orval (`npm run api:generate`), este
 * hook puede migrarse al patrón del CrearRelevo (import dinámico).
 *
 * El endpoint es coherente con el CrearRelevoEndpoint en tenancy:
 * solo el CuidadorPrincipal del dependiente puede editar.
 */
export const useEditarRelevo = () => {
  return useSWRMutation(
    '/api/directorio-relevos/editar',
    async (
      _: string,
      { arg }: { arg: { id: string } & EditarRelevoBody },
    ): Promise<CustomFetchResponse<CrearRelevoResponse | undefined>> => {
      const { id, ...body } = arg;
      const respuesta = (await customFetch<unknown>(
        `/api/directorio-relevos/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )) as CustomFetchResponse<CrearRelevoResponse | undefined>;
      return respuesta;
    },
  );
};

/**
 * Hook de mutación para eliminar (soft-delete) un relevo.
 *
 * Usa `customFetch` directo por la misma razón que `useEditarRelevo`:
 * el endpoint `DELETE /api/directorio-relevos/{id}` aún no está en el
 * código generado de Orval. Migrar cuando se regenere.
 *
 * Tenancy: solo el CuidadorPrincipal del dependiente puede eliminar.
 * El backend responde 204 No Content si la operación es exitosa.
 */
export const useEliminarRelevo = () => {
  return useSWRMutation(
    '/api/directorio-relevos/eliminar',
    async (
      _: string,
      { arg }: { arg: { id: string } },
    ): Promise<CustomFetchResponse<unknown>> => {
      const { id } = arg;
      const respuesta = (await customFetch<unknown>(
        `/api/directorio-relevos/${id}`,
        {
          method: 'DELETE',
        },
      )) as CustomFetchResponse<unknown>;
      return respuesta;
    },
  );
};

export type { RACPDBackendFeaturesDirectorioRelevosListarRelevoItemResponse as RelevoItemResponse };
export type { RACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpointParams as ListarDirectorioRelevosParams };
