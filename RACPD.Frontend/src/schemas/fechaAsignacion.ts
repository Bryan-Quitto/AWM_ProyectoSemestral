/**
 * Helpers de formato para fechas de asignación de vínculos entre
 * usuarios y perfiles dependientes.
 *
 * El backend expone `fechaAsignacion` como ISO 8601 con offset
 * (`DateTimeOffset` → string). Por reglas del proyecto, toda fecha
 * visible al usuario se renderiza en zona horaria `America/Guayaquil`
 * (UTC-5, sin horario de verano) y en formato `dd/MM/yyyy`.
 *
 * Mantenerlo centralizado evita divergencias entre la lista de
 * dependientes y el detalle.
 */

const ZONA_HORARIA_ECUADOR = 'America/Guayaquil';

/**
 * Formato largo en español: "15 de marzo de 2026".
 * Se usa como subtítulo cuando hay espacio y queremos legibilidad
 * para el cuidador.
 */
const FORMATO_LARGO_ES = new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONA_HORARIA_ECUADOR,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

/**
 * Devuelve la fecha en formato legible en español para Ecuador.
 * Si el valor es nulo, vacío o inválido, devuelve `null` para que
 * la UI decida si mostrar u ocultar el subtítulo (Regla Zero-Indulgence:
 * nunca imprimir "Invalid Date").
 */
export function formatearFechaAsignacion(
  valor: string | null | undefined,
): string | null {
  if (typeof valor !== 'string' || valor.trim().length === 0) return null;

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;

  // Capitalizamos la primera letra del mes porque `Intl` con `month: 'long'`
  // puede devolverlo en minúscula según el runtime.
  const texto = FORMATO_LARGO_ES.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
