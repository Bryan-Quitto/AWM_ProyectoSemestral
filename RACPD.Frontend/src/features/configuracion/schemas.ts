import { z } from 'zod';
import { nombreRegla, apellidoRegla, contrasenaRegla } from '../../schemas/usuario';

export const configuracionPerfilSchema = z.object({
  nombre: nombreRegla,
  apellido: apellidoRegla,
});

export type ConfiguracionPerfilFormData = z.infer<typeof configuracionPerfilSchema>;

export const configuracionContrasenaSchema = z.object({
  contrasenaActual: z.string().min(1, 'La contraseña actual es requerida'),
  nuevaContrasena: contrasenaRegla,
  confirmarContrasena: z.string().min(1, 'Debes confirmar tu contraseña'),
}).refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarContrasena'],
});

export type ConfiguracionContrasenaFormData = z.infer<typeof configuracionContrasenaSchema>;
