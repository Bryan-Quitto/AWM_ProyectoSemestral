import { z } from 'zod';
import { nombreRegla, apellidoRegla, contrasenaRegla } from '../../../schemas/usuario';

export const contrasenaSchema = contrasenaRegla;

export const completarPerfilSchema = z
  .object({
    nombre: nombreRegla,
    apellido: apellidoRegla,
    contrasena: contrasenaSchema,
    confirmarContrasena: z.string().min(1, 'Confirma tu contraseña.')
  })
  .refine((data) => data.contrasena === data.confirmarContrasena, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena']
  });

export type CompletarPerfilForm = z.infer<typeof completarPerfilSchema>;
