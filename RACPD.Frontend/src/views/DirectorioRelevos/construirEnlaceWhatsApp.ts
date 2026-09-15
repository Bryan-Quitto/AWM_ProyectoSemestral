/**
 * Construye un deep-link `wa.me/{telefono}?text={mensaje}` con
 * normalización robusta para celulares ecuatorianos.
 *
 * Comportamientos:
 * - Quita todo lo no numérico.
 * - Si el número empieza con `09` y tiene 10 dígitos, lo convierte a
 *   formato E.164 sin el 0 inicial: `09XXXXXXXX` → `5939XXXXXXXX`.
 * - Si ya viene como `5939XXXXXXXX` o `+5939XXXXXXXX`, lo deja igual.
 * - Si solo trae el cuerpo `9XXXXXXXX` (9 dígitos), le antepone `593`.
 * - Codifica el mensaje con `encodeURIComponent` (RFC 3986).
 *
 * Casos cubiertos:
 *   `+593 99 123 4567` → `593991234567`
 *   `0991234567`       → `593991234567`
 *   `593991234567`     → `593991234567`
 *   `991234567`        → `593991234567` (asume prefijo país)
 */
export const construirEnlaceWhatsApp = (
  telefono: string,
  mensaje: string,
): string => {
  let digitos = telefono.replace(/\D/g, '');

  // Caso: 09XXXXXXXX (formato local con 0 líder) → 5939XXXXXXXX
  if (digitos.startsWith('09') && digitos.length === 10) {
    digitos = `593${digitos.slice(1)}`;
  } else if (digitos.length === 9 && digitos.startsWith('9')) {
    // Caso: 9XXXXXXXX sin código de país → le anteponemos 593
    digitos = `593${digitos}`;
  }

  const texto = encodeURIComponent(mensaje);
  return `https://wa.me/${digitos}?text=${texto}`;
};
