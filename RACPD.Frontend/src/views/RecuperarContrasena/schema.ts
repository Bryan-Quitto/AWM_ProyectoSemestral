import { z } from 'zod';

/**
 * Esquema Zod para el formulario de "Recuperar Contraseña".
 *
 * Solo pide el correo electrónico. La validación de formato es la primera
 * línea de defensa; la confirmación de existencia del correo la hace
 * Supabase Auth (cuya respuesta nunca se distingue del éxito para evitar
 * enumeración de cuentas).
 */
export const recuperarContrasenaSchema = z.object({
  correo: z
    .string()
    .min(1, 'El correo es requerido.')
    .email('El correo no tiene un formato válido.')
});

export type RecuperarContrasenaValores = z.infer<typeof recuperarContrasenaSchema>;
