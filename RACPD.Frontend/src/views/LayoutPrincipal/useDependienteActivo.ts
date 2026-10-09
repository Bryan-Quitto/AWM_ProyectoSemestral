import { useMemo, useSyncExternalStore } from 'react';
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

// Store singleton en memoria para suscripción reactiva y sincronización multi-pestaña
type Listener = () => void;
const listeners = new Set<Listener>();

let snapshotActual: string | null = leerIdAlmacenado();

const notificar = () => {
  snapshotActual = leerIdAlmacenado();
  listeners.forEach((listener) => listener());
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === CLAVE_STORAGE_DEPENDIENTE_ACTIVO) {
      notificar();
    }
  });
}

const suscribir = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const obtenerSnapshot = (): string | null => snapshotActual;

const obtenerServidorSnapshot = (): string | null => null;

/**
 * Mutador reactivo del dependiente activo.
 * Persiste en localStorage y notifica sincrónicamente a los componentes suscritos.
 */
export const cambiarDependienteActivo = (nuevoId: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (nuevoId) {
      window.localStorage.setItem(CLAVE_STORAGE_DEPENDIENTE_ACTIVO, nuevoId);
    } else {
      window.localStorage.removeItem(CLAVE_STORAGE_DEPENDIENTE_ACTIVO);
    }
  } catch {
    // Almacenamiento no disponible (modo privado, cuota, etc.)
  } finally {
    notificar();
  }
};

/**
 * Hook compartido que devuelve el dependiente activo persistido en
 * localStorage utilizando `useSyncExternalStore` para prevenir condiciones de carrera
 * y garantizar sincronización multi-pestaña instantánea.
 */
export const useDependienteActivo = (): {
  dependienteId: string | null;
  dependienteNombre: string;
} => {
  const { data } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();

  const idAlmacenado = useSyncExternalStore(
    suscribir,
    obtenerSnapshot,
    obtenerServidorSnapshot
  );

  return useMemo(() => {
    const lista = (data?.data ?? []) as DependienteResumen[];
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
  }, [data, idAlmacenado]);
};