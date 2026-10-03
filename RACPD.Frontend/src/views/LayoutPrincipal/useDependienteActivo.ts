import { useMemo } from 'react';
import { useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint } from '../../api/generated/api/api';

export const CLAVE_STORAGE_DEPENDIENTE_ACTIVO = 'racpd.dependienteActivoId';

type DependienteResumen = {
  perfilId?: string;
  nombreCompleto?: string;
  rolEnDependiente?: string;
};

/**
 * Lee el id persistido en localStorage de forma SEGURA.
 * Devuelve null si el almacenamiento no está disponible (SSR / modo
 * privado / cuota) o si el valor almacenado está vacío.
 */
const leerIdAlmacenado = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const guardado = window.localStorage.getItem(CLAVE_STORAGE_DEPENDIENTE_ACTIVO);
    return guardado !== null && guardado.length > 0 ? guardado : null;
  } catch {
    return null;
  }
};

/**
 * Hook compartido que devuelve el dependiente activo persistido en
 * localStorage. Si el id almacenado ya no existe en la lista, se
 * recalcula al primero de la lista (preferentemente el Principal).
 *
 * IMPORTANTE: este hook NO usa useEffect ni setState. La derivación es
 * 100% durante render, de modo que cumple las reglas de React Compiler
 * (no cascading renders) y se mantiene simple.
 *
 * Si el usuario cambia el dependiente activo desde `SelectorDependienteActivo`
 * (que sí escribe en localStorage), basta refrescar el árbol SWR para
 * que el nuevo id aparezca reflejado.
 */
export const useDependienteActivo = (): {
  dependienteId: string | null;
  dependienteNombre: string;
} => {
  const { data } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();

  return useMemo(() => {
    const lista = (data?.data ?? []) as DependienteResumen[];
    const idAlmacenado = leerIdAlmacenado();
    const almacenadoValido =
      idAlmacenado !== null && lista.some((d) => d.perfilId === idAlmacenado);

    const dependienteElegido = almacenadoValido
      ? lista.find((d) => d.perfilId === idAlmacenado) ?? null
      : (() => {
          const principal = lista.find((d) => d.rolEnDependiente === 'CuidadorPrincipal');
          return principal ?? lista[0] ?? null;
        })();

    return {
      dependienteId: dependienteElegido?.perfilId ?? null,
      dependienteNombre: dependienteElegido?.nombreCompleto ?? '',
    };
  }, [data]);
};