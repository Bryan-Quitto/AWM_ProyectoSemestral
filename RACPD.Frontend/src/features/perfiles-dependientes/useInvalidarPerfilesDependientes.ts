import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import type { Key } from 'swr';

/**
 * Prefijo común a todas las keys SWR generadas por Orval para los endpoints
 * del feature `PerfilesDependientes`.
 *
 * Coincide con el primer segmento del path que Orval usa como key:
 * `/api/perfiles-dependientes/...`.
 *
 * Mantenerlo centralizado evita que un cambio de versión de Orval rompa la
 * invalidación por prefijo.
 */
export const PREFIJO_KEY_PERFILES_DEPENDIENTES = '/api/perfiles-dependientes';

/**
 * Hook compartido para invalidar TODOS los caches SWR relacionados con el
 * feature de perfiles de dependientes.
 *
 * Lo que logra:
 * - Invalida tanto el listado (`ListarMisDependientes`) como el detalle
 *   (`ObtenerDependiente` por id), con un solo llamado.
 * - Evita la doble suscripción a la misma key en distintas vistas
 *   (route + componente) provoque datos stale al volver atrás.
 * - Es seguro contra cambios futuros: añade aquí cualquier nuevo endpoint
 *   que cuelgue de `PerfilesDependientes`.
 *
 * Lo que **NO** hace (antiobstrucción):
 * - No toca el cache de Agenda ni de otros features. Si en el futuro
 *   `actualizar perfil` debe invalidar Agenda, crea un hook aparte.
 */
export function useInvalidarPerfilesDependientes() {
  const { mutate } = useSWRConfig();

  return useCallback(
    async (perfilId?: string): Promise<void> => {
      // `mutate` con predicado recorre todas las keys registradas en el cache.
      // Si recibe `perfilId`, además hace un revalidate puntual del detalle.
      await mutate(
        (key) =>
          typeof key === 'string' &&
          key.startsWith(PREFIJO_KEY_PERFILES_DEPENDIENTES),
        undefined,
        { revalidate: true },
      );

      if (perfilId) {
        const keyDetalle: Key = `${PREFIJO_KEY_PERFILES_DEPENDIENTES}/${perfilId}`;
        await mutate(keyDetalle);
      }
    },
    [mutate],
  );
}
