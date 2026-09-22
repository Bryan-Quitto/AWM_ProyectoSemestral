/**
 * Utilidad de dominio para la regla dura de cancelación con antena mínima
 * de 72 horas (3 días), impuesta por el backend en
 * `CancelarReservaEndpoint` (Persona 2 / Semana 2).
 *
 * El cliente usa esta función para reflejar la regla ANTES de llamar al
 * backend, evitando un round-trip HTTP innecesario en un momento de alta
 * frustración para el cuidador.
 *
 * Coherencia con el backend (`BloqueTurno.CalcularInicioEnEcuador`):
 *   - `fecha` (YYYY-MM-DD) + `horaInicio` (HH:mm o HH:mm:ss) se interpretan
 *     como hora local del cliente (que en RACPD es America/Guayaquil).
 *   - Se comparan contra `ahora` (epoch ms, inyectable para tests).
 *
 * Decisión de diseño:
 *   - Se usa la zona horaria del navegador (`new Date(y, m, d, h, min)`)
 *     en lugar de `Intl.DateTimeFormat` para evitar problemas de hidratación
 *     SSR y diferencias entre navegadores. El navegador del cuidador en
 *     Ecuador ya está en America/Guayaquil por configuración regional del
 *     sistema operativo, y la verificación backend re-evalúa contra UTC.
 *   - Si los datos vienen incompletos, devolvemos `false` (no bloquear).
 */

export const MENSAJE_BLOQUEO_72H =
  'No puedes retirarte con menos de 3 días de antelación. Por favor, comunícate directamente con el cuidador principal.';

export const UMBRAL_ANTELACION_MS = 72 * 60 * 60 * 1000;

/**
 * Devuelve `true` cuando faltan MENOS de 72 horas para el inicio del turno.
 *
 * @param fecha       "YYYY-MM-DD" (DateOnly del backend).
 * @param horaInicio  "HH:mm:ss" o "HH:mm".
 * @param ahora       Epoch ms (opcional, default `Date.now()`). Útil para tests.
 */
export const calcularAntelacionMinima = (
  fecha: string | undefined | null,
  horaInicio: string | undefined | null,
  ahora: number = Date.now(),
): boolean => {
  if (!fecha || !horaInicio) return false;

  const partesFecha = fecha.split('-').map(Number);
  const [yyyy, mm, dd] = partesFecha;
  if (partesFecha.length !== 3 || [yyyy, mm, dd].some(Number.isNaN)) return false;

  const hhmm = horaInicio.slice(0, 5);
  const [h, m] = hhmm.split(':').map(Number);
  if ([h, m].some((v) => v === undefined || Number.isNaN(v))) return false;

  const inicioLocal = new Date(yyyy, (mm ?? 1) - 1, dd, h ?? 0, m ?? 0, 0, 0);
  const diferenciaMs = inicioLocal.getTime() - ahora;

  // Estricto: si faltan >= 72h → false (NO bloqueado).
  //           si faltan <  72h → true  (BLOQUEADO).
  return diferenciaMs < UMBRAL_ANTELACION_MS;
};
