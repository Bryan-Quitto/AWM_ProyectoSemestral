import {
  useRACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpoint,
} from '../../../api/generated/api/api';
import type {
  RACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpointParams,
  RACPDBackendFeaturesDirectorioRelevosListarRelevoItemResponse,
} from '../../../api/generated/model';

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

  return {
    relevos: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
};

export type { RACPDBackendFeaturesDirectorioRelevosListarRelevoItemResponse as RelevoItemResponse };
export type { RACPDBackendFeaturesDirectorioRelevosListarListarDirectorioRelevosEndpointParams as ListarDirectorioRelevosParams };
