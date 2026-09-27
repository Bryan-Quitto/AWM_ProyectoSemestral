/**
 * Devuelve el saludo contextual según la hora local del navegador.
 * Reglas de SPEC 009 §10.6:
 *   05:00–11:59 → "Buenos días"
 *   12:00–18:59 → "Buenas tardes"
 *   19:00–04:59 → "Buenas noches"
 *
 * Exportado desde un archivo `utilidades.ts` separado del componente
 * para cumplir la regla `react(only-export-components)` de oxlint
 * (fast-refresh requiere que un archivo exporte solo componentes).
 */
export const obtenerSaludoContextual = (fecha: Date = new Date()): string => {
  const hora = fecha.getHours();
  if (hora >= 5 && hora <= 11) return 'Buenos días';
  if (hora >= 12 && hora <= 18) return 'Buenas tardes';
  return 'Buenas noches';
};
