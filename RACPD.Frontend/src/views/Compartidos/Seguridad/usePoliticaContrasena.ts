/**
 * Hook `usePoliticaContrasena`.
 *
 * Evalúa una contraseña contra la política de seguridad mínima exigida por
 * el proyecto RACPD y devuelve un objeto memoizado con:
 * - `requisitos`: cumplimiento individual de cada regla (booleanos).
 * - `cumplidos`: número total de requisitos satisfechos.
 * - `nivel`: clasificación cualitativa de la fortaleza de la contraseña.
 *
 * El hook es 100% determinista y puro: no produce lecturas ni escrituras
 * secundarias y memoiza su resultado con `useMemo` para optimizar el uso en
 * componentes que cambian con frecuencia.
 */
import { useMemo } from 'react';

/**
 * Niveles cualitativos posibles para clasificar una contraseña.
 */
export type NivelFortaleza = 'vacia' | 'debil' | 'media' | 'fuerte';

/**
 * Resultado de evaluar una contraseña contra la política de seguridad.
 */
export type ResultadoPoliticaContrasena = {
  requisitos: {
    longitud: boolean;
    mayuscula: boolean;
    minuscula: boolean;
    digito: boolean;
    especial: boolean;
  };
  cumplidos: number;
  nivel: NivelFortaleza;
};

/**
 * Evalúa la contraseña recibida contra las cinco reglas de la política.
 *
 * Esta función es interna del módulo y NO se exporta, tal como exige el
 * requerimiento: el detalle de la evaluación permanece encapsulado dentro
 * del hook que la consume.
 */
function evaluarPolitica(contrasena: string): ResultadoPoliticaContrasena {
  const longitud = contrasena.length >= 8;
  const mayuscula = /[A-Z]/.test(contrasena);
  const minuscula = /[a-z]/.test(contrasena);
  const digito = /[0-9]/.test(contrasena);
  const especial = /[^A-Za-z0-9]/.test(contrasena);

  const requisitos = { longitud, mayuscula, minuscula, digito, especial };

  const cumplidos =
    Number(longitud) +
    Number(mayuscula) +
    Number(minuscula) +
    Number(digito) +
    Number(especial);

  let nivel: NivelFortaleza;
  if (contrasena.length === 0) {
    nivel = 'vacia';
  } else if (cumplidos <= 2) {
    nivel = 'debil';
  } else if (cumplidos <= 4) {
    nivel = 'media';
  } else {
    nivel = 'fuerte';
  }

  return { requisitos, cumplidos, nivel };
}

/**
 * Hook que evalúa una contraseña contra la política de seguridad y
 * memoiza el resultado. Se utiliza desde componentes que necesitan
 * mostrar la fortaleza de la contraseña en tiempo real.
 *
 * @param contrasena Cadena de texto con la contraseña a evaluar.
 * @returns Objeto con el detalle del cumplimiento y el nivel de fortaleza.
 */
export function usePoliticaContrasena(contrasena: string): ResultadoPoliticaContrasena {
  return useMemo<ResultadoPoliticaContrasena>(
    () => evaluarPolitica(contrasena),
    [contrasena],
  );
}