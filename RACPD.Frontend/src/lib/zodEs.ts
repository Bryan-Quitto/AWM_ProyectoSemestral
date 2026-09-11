import { z } from 'zod';
import { es } from 'zod/locales';

/**
 * Inicializa el soporte de idioma español nativo de Zod v4.
 * Esto traduce automáticamente errores genéricos como "too_small",
 * "too_big", "invalid_type", etc., a español neutro.
 */
export function inicializarZodEs() {
  z.config(es());
}
