/**
 * SSoT (Single Source of Truth) de la política de contraseñas del proyecto RACPD.
 *
 * Este módulo exporta las constantes que cualquier consumidor de la política
 * (el hook `usePoliticaContrasena`, el esquema Zod de la vista de
 * restablecimiento de contraseña, el indicador visual de fortaleza, etc.)
 * debe importar. Está prohibido redeclarar estas reglas en otro archivo:
 * si el negocio cambia la política, se modifica únicamente aquí.
 *
 * Alineado a la regla "Estado Derivado vs Efectos" de `SKILLS.md`:
 * las constantes son valores puros y derivables; cualquier consumidor
 * que evalúe una contraseña contra esta política obtendrá el mismo
 * resultado determinista.
 */

/**
 * Longitud mínima exigida a una contraseña en el sistema.
 *
 * Debe coincidir con la longitud configurada en el panel de Supabase Auth
 * (Authentication → Policies → Password). Si se modifica aquí, replicar
 * el cambio en Supabase para evitar rechazos en el servidor.
 */
export const LONGITUD_MINIMA: number = 8;

/**
 * Expresión regular que evalúa la presencia de una letra mayúscula (A-Z).
 */
export const PATRON_MAYUSCULA: RegExp = /[A-Z]/;

/**
 * Expresión regular que evalúa la presencia de una letra minúscula (a-z).
 */
export const PATRON_MINUSCULA: RegExp = /[a-z]/;

/**
 * Expresión regular que evalúa la presencia de un dígito (0-9).
 */
export const PATRON_DIGITO: RegExp = /[0-9]/;

/**
 * Expresión regular que evalúa la presencia de un carácter especial
 * (cualquier símbolo que no sea alfanumérico).
 */
export const PATRON_ESPECIAL: RegExp = /[^A-Za-z0-9]/;

/**
 * Patrones exigidos como mínimo a una contraseña.
 *
 * Se importan en el esquema Zod para validar la robustez antes de enviar
 * la petición a Supabase (primera línea de defensa). El autoritativo
 * sigue siendo `supabase.auth.updateUser`.
 *
 * Si el negocio decide exigir también símbolo, basta con añadir
 * `PATRON_ESPECIAL` a este arreglo y TODOS los consumidores lo reflejarán.
 */
export const PATRONES_REQUERIDOS: ReadonlyArray<RegExp> = [
  PATRON_MAYUSCULA,
  PATRON_DIGITO
];
