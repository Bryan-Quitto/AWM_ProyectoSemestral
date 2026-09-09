import { z } from 'zod';
import {
  LONGITUD_MINIMA,
  PATRONES_REQUERIDOS
} from '../../components/Seguridad/politicaContrasena';

/**
 * Esquema Zod para el formulario de "Restablecer Contraseña".
 *
 * Las reglas de la política (`LONGITUD_MINIMA`, `PATRONES_REQUERIDOS`)
 * se importan desde la SSoT `politicaContrasena.ts`. Prohibido
 * redeclararlas aquí. Si el negocio cambia la política, se modifica
 * únicamente el archivo de constantes y tanto este esquema como
 * `usePoliticaContrasena` lo reflejarán automáticamente.
 *
 * Este esquema es la PRIMERA línea de defensa antes de enviar la
 * petición a Supabase. La validación AUTORITATIVA sigue siendo de
 * Supabase Auth (`updateUser`).
 */
export const restablecerContrasenaSchema = z
  .object({
    nuevaContrasena: z
      .string()
      .min(1, 'La contraseña es requerida.')
      .min(
        LONGITUD_MINIMA,
        `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`
      )
      .refine(
        (valor) => PATRONES_REQUERIDOS.every((patron) => patron.test(valor)),
        'La contraseña debe cumplir la política de seguridad configurada.'
      ),
    confirmarContrasena: z
      .string()
      .min(1, 'Debes confirmar la contraseña.')
  })
  .refine(
    (data) => data.nuevaContrasena === data.confirmarContrasena,
    {
      message: 'Las contraseñas no coinciden.',
      path: ['confirmarContrasena']
    }
  );

export type RestablecerContrasenaValores = z.infer<
  typeof restablecerContrasenaSchema
>;
