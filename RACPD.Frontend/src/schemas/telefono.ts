import { z } from 'zod';

/**
 * Código de país de Ecuador (E.164) aplicado como prefijo único en RACPD.
 * Todo número de Ecuador se persiste y se transmite con este prefijo.
 */
export const PREFIJO_ECUADOR = '+593';

/**
 * Longitud total esperada de un número ecuatoriano válido dentro de RACPD:
 * prefijo (+593) + 9 dígitos. El primer dígito siempre es 9 (celular).
 */
export const LONGITUD_ECUADOR = 9;

/**
 * Regex canónico de número ecuatoriano en formato E.164.
 * Regla única y compartida para evitar duplicación en los schemas de dominio.
 */
export const TELEFONO_ECUADOR_REGEX = /^\+5939\d{8}$/;

/**
 * Mensaje único, claro y dirigido al cuidador para evitar ambigüedades en español.
 */
export const MENSAJE_TELEFONO_ECUADOR =
  'Ingresa un número de Ecuador válido (ej. +5939XXXXXXXX).';

/**
 * Regla Zod reutilizable para cualquier campo `telefono` de Ecuador en el frontend.
 *
 * Acepta tanto el formato completo E.164 (`+5939XXXXXXXX`) como el cuerpo solo
 * (`9XXXXXXXX`), porque el componente `CampoTelefonoEcuador` trabaja solo con
 * el cuerpo para evitar duplicar el prefijo en pantalla. La normalización a
 * E.164 ocurre en el `onSubmit` mediante `normalizarTelefonoEcuador` antes de
 * enviar al backend.
 *
 * @example
 *   telefonoWhatsApp: telefonoEcuadorRegla,
 */
export const telefonoEcuadorRegla = z
  .string()
  .regex(/^(?:\+5939\d{8}|9\d{8})$/, MENSAJE_TELEFONO_ECUADOR);

/**
 * Normaliza cualquier cadena pegada por el usuario al formato canónico E.164
 * de Ecuador (`+5939XXXXXXXX`).
 *
 * Comportamientos:
 * - Quita un prefijo `+593` si el usuario lo incluyó.
 * - Quita el `0` líder típico de los números locales (`0939887766` → `939887766`).
 * - Elimina espacios, guiones, paréntesis y cualquier carácter no numérico.
 * - Recompone el prefijo `+593` y limita a 9 dígitos.
 *
 * Si tras la limpieza el cuerpo no alcanza los 9 dígitos, devuelve la mejor
 * aproximación posible (lo que se haya podido rescatar) para que el schema
 * Zod emita su mensaje de error personalizado.
 */
export function normalizarTelefonoEcuador(entrada: string): string {
  if (typeof entrada !== 'string') return '';

  let digitos = entrada.replace(/\D/g, '');

  // Si el usuario incluyó el código de país, lo descartamos para reconstruirlo.
  if (digitos.startsWith('593')) {
    digitos = digitos.slice(3);
  }

  // Quito el "0" líder típico del formato nacional (0939887766 → 939887766).
  if (digitos.startsWith('0')) {
    digitos = digitos.slice(1);
  }

  // Limito a la longitud esperada para no contaminar la base de datos.
  digitos = digitos.slice(0, LONGITUD_ECUADOR);

  if (digitos.length === 0) return '';
  return `${PREFIJO_ECUADOR}${digitos}`;
}
