import { useState, useEffect, useCallback } from 'react';

export type TamanoTexto = 'normal' | 'grande' | 'extragrande';

export interface PreferenciasAccesibilidad {
  tamanoTexto: TamanoTexto;
  altoContraste: boolean;
  escalaGrises: boolean;
  fuenteLegible: boolean;
  subrayarEnlaces: boolean;
}

export const PREFERENCIAS_POR_DEFECTO: PreferenciasAccesibilidad = {
  tamanoTexto: 'normal',
  altoContraste: false,
  escalaGrises: false,
  fuenteLegible: false,
  subrayarEnlaces: false,
};

const CLAVE_ALMACENAMIENTO = 'racpd_preferencias_accesibilidad';

export const usePreferenciasAccesibilidad = () => {
  const [preferencias, setPreferencias] = useState<PreferenciasAccesibilidad>(() => {
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
      // Si falla la lectura de localStorage, conservamos valores por defecto
    }
    return PREFERENCIAS_POR_DEFECTO;
  });

  // Aplica las clases de accesibilidad en el elemento raíz <html>
  useEffect(() => {
    const raiz = document.documentElement;

    // Manejo de tamaño de texto
    raiz.classList.remove('accesibilidad-texto-grande', 'accesibilidad-texto-extragrande');
    if (preferencias.tamanoTexto === 'grande') {
      raiz.classList.add('accesibilidad-texto-grande');
    } else if (preferencias.tamanoTexto === 'extragrande') {
      raiz.classList.add('accesibilidad-texto-extragrande');
    }

    // Alto contraste
    if (preferencias.altoContraste) {
      raiz.classList.add('accesibilidad-alto-contraste');
    } else {
      raiz.classList.remove('accesibilidad-alto-contraste');
    }

    // Escala de grises
    if (preferencias.escalaGrises) {
      raiz.classList.add('accesibilidad-escala-grises');
    } else {
      raiz.classList.remove('accesibilidad-escala-grises');
    }

    // Fuente legible
    if (preferencias.fuenteLegible) {
      raiz.classList.add('accesibilidad-fuente-legible');
    } else {
      raiz.classList.remove('accesibilidad-fuente-legible');
    }

    // Subrayar enlaces
    if (preferencias.subrayarEnlaces) {
      raiz.classList.add('accesibilidad-subrayar-enlaces');
    } else {
      raiz.classList.remove('accesibilidad-subrayar-enlaces');
    }

    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(preferencias));
    } catch {
      // Manejo seguro en caso de cuota excedida de almacenamiento
    }
  }, [preferencias]);

  const cambiarTamanoTexto = useCallback((nuevoTamano: TamanoTexto) => {
    setPreferencias((prev) => ({ ...prev, tamanoTexto: nuevoTamano }));
  }, []);

  const alternarAltoContraste = useCallback(() => {
    setPreferencias((prev) => ({ ...prev, altoContraste: !prev.altoContraste }));
  }, []);

  const alternarEscalaGrises = useCallback(() => {
    setPreferencias((prev) => ({ ...prev, escalaGrises: !prev.escalaGrises }));
  }, []);

  const alternarFuenteLegible = useCallback(() => {
    setPreferencias((prev) => ({ ...prev, fuenteLegible: !prev.fuenteLegible }));
  }, []);

  const alternarSubrayarEnlaces = useCallback(() => {
    setPreferencias((prev) => ({ ...prev, subrayarEnlaces: !prev.subrayarEnlaces }));
  }, []);

  const restablecerTodo = useCallback(() => {
    setPreferencias(PREFERENCIAS_POR_DEFECTO);
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
    restablecerTodo,
  };
};
