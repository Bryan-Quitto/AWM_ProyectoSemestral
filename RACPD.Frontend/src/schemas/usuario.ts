import { z } from 'zod';

export const nombreRegla = z
  .string()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(80, 'El nombre no puede superar los 80 caracteres.')
  .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, apóstrofes y guiones.');

export const apellidoRegla = z
  .string()
  .min(2, 'El apellido debe tener al menos 2 caracteres.')
  .max(80, 'El apellido no puede superar los 80 caracteres.')
  .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, apóstrofes y guiones.');

export const contrasenaRegla = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula.')
  .regex(/[a-z]/, 'Debe incluir al menos una minúscula.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial.');
