import { z } from 'zod';

export const contrasenaSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula.')
  .regex(/[a-z]/, 'Debe incluir al menos una minúscula.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial.');

export const completarPerfilSchema = z
  .object({
    nombre: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(80, 'El nombre no puede superar los 80 caracteres.')
      .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, apóstrofes y guiones.'),
    apellido: z
      .string()
      .min(2, 'El apellido debe tener al menos 2 caracteres.')
      .max(80, 'El apellido no puede superar los 80 caracteres.')
      .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, apóstrofes y guiones.'),
    contrasena: contrasenaSchema,
    confirmarContrasena: z.string().min(1, 'Confirma tu contraseña.')
  })
  .refine((data) => data.contrasena === data.confirmarContrasena, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena']
  });

export type CompletarPerfilForm = z.infer<typeof completarPerfilSchema>;
