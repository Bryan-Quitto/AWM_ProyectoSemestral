import { useCallback, useSyncExternalStore } from 'react';

export type TamanoTexto = 'normal' | 'grande' | 'extragrande';

export interface PreferenciasAccesibilidad {
  tamanoTexto: TamanoTexto;
  altoContraste: boolean;
  escalaGrises: boolean;
  fuenteLegible: boolean;
  subrayarEnlaces: boolean;
  botonFlotanteVisible: boolean;
}

export const PREFERENCIAS_POR_DEFECTO: PreferenciasAccesibilidad = {
  tamanoTexto: 'normal',
  altoContraste: false,
  escalaGrises: false,
  fuenteLegible: false,
  subrayarEnlaces: false,
  botonFlotanteVisible: true,
};

const CLAVE_ALMACENAMIENTO = 'racpd_preferencias_accesibilidad';

// Helper para leer el estado actual desde localStorage
const leerPreferenciasGuardadas = (): PreferenciasAccesibilidad => {
  if (typeof window === 'undefined') return PREFERENCIAS_POR_DEFECTO;
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (guardado) {
      const parseado = JSON.parse(guardado) as Partial<PreferenciasAccesibilidad>;
      return {
        ...PREFERENCIAS_POR_DEFECTO,
        ...parseado,
      };
    }
  } catch {
    // Si falla la lectura, se mantiene el valor por defecto
  }
  return PREFERENCIAS_POR_DEFECTO;
};

// Aplica las clases de accesibilidad en el elemento raíz <html>
const aplicarClasesEnDOM = (prefs: PreferenciasAccesibilidad) => {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;

  // Tamaño de texto
  raiz.classList.remove('accesibilidad-texto-grande', 'accesibilidad-texto-extragrande');
  if (prefs.tamanoTexto === 'grande') {
    raiz.classList.add('accesibilidad-texto-grande');
  } else if (prefs.tamanoTexto === 'extragrande') {
    raiz.classList.add('accesibilidad-texto-extragrande');
  }

  // Alto contraste
  if (prefs.altoContraste) {
    raiz.classList.add('accesibilidad-alto-contraste');
  } else {
    raiz.classList.remove('accesibilidad-alto-contraste');
  }

  // Escala de grises
  if (prefs.escalaGrises) {
    raiz.classList.add('accesibilidad-escala-grises');
  } else {
    raiz.classList.remove('accesibilidad-escala-grises');
  }

  // Fuente legible
  if (prefs.fuenteLegible) {
    raiz.classList.add('accesibilidad-fuente-legible');
  } else {
    raiz.classList.remove('accesibilidad-fuente-legible');
  }

  // Subrayar enlaces
  if (prefs.subrayarEnlaces) {
    raiz.classList.add('accesibilidad-subrayar-enlaces');
  } else {
    raiz.classList.remove('accesibilidad-subrayar-enlaces');
  }
};

// Estado singleton en memoria para compartir entre todos los componentes
let estadoGlobal: PreferenciasAccesibilidad = leerPreferenciasGuardadas();
aplicarClasesEnDOM(estadoGlobal);

const oyentes = new Set<() => void>();

const suscribir = (callback: () => void) => {
  oyentes.add(callback);

  const manejarStorage = (evento: StorageEvent) => {
    if (evento.key === CLAVE_ALMACENAMIENTO) {
      estadoGlobal = leerPreferenciasGuardadas();
      aplicarClasesEnDOM(estadoGlobal);
      oyentes.forEach((oyente) => oyente());
    }
  };

  window.addEventListener('storage', manejarStorage);
  return () => {
    oyentes.delete(callback);
    window.removeEventListener('storage', manejarStorage);
  };
};

const obtenerSnapshot = () => estadoGlobal;

const actualizarEstadoGlobal = (nuevoEstado: PreferenciasAccesibilidad) => {
  estadoGlobal = nuevoEstado;
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(nuevoEstado));
  } catch {
    // Manejo seguro en caso de error de storage
  }
  aplicarClasesEnDOM(nuevoEstado);
  oyentes.forEach((oyente) => oyente());
};

export const usePreferenciasAccesibilidad = () => {
  const preferencias = useSyncExternalStore(suscribir, obtenerSnapshot, () => PREFERENCIAS_POR_DEFECTO);

  const cambiarTamanoTexto = useCallback((nuevoTamano: TamanoTexto) => {
    actualizarEstadoGlobal({
      ...estadoGlobal,
      tamanoTexto: nuevoTamano,
    });
  }, []);

  const alternarAltoContraste = useCallback(() => {
    actualizarEstadoGlobal({
      ...estadoGlobal,
      altoContraste: !estadoGlobal.altoContraste,
    });
  }, []);

  const alternarEscalaGrises = useCallback(() => {
    actualizarEstadoGlobal({
      ...estadoGlobal,
      escalaGrises: !estadoGlobal.escalaGrises,
    });
  }, []);

  const alternarFuenteLegible = useCallback(() => {
    actualizarEstadoGlobal({
      ...estadoGlobal,
      fuenteLegible: !estadoGlobal.fuenteLegible,
    });
  }, []);

  const alternarSubrayarEnlaces = useCallback(() => {
    actualizarEstadoGlobal({
      ...estadoGlobal,
      subrayarEnlaces: !estadoGlobal.subrayarEnlaces,
    });
  }, []);

  const alternarBotonFlotanteVisible = useCallback(() => {
    actualizarEstadoGlobal({
      ...estadoGlobal,
      botonFlotanteVisible: !estadoGlobal.botonFlotanteVisible,
    });
  }, []);

  const restablecerTodo = useCallback(() => {
    actualizarEstadoGlobal(PREFERENCIAS_POR_DEFECTO);
  }, []);

  const totalModificacionesActivas = 
    (preferencias.tamanoTexto !== 'normal' ? 1 : 0) +
    (preferencias.altoContraste ? 1 : 0) +
    (preferencias.escalaGrises ? 1 : 0) +
    (preferencias.fuenteLegible ? 1 : 0) +
    (preferencias.subrayarEnlaces ? 1 : 0);

  return {
    preferencias,
    totalModificacionesActivas,
    cambiarTamanoTexto,
    alternarAltoContraste,
    alternarEscalaGrises,
    alternarFuenteLegible,
    alternarSubrayarEnlaces,
    alternarBotonFlotanteVisible,
    restablecerTodo,
  };
};
