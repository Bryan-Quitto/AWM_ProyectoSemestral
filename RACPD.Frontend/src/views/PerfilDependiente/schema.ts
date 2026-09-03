import { z } from 'zod';

export const TIPOS_SANGRE = [
  'APositivo',
  'ANegativo',
  'BPositivo',
  'BNegativo',
  'ABPositivo',
  'ABNegativo',
  'OPositivo',
  'ONegativo',
  'Desconocido',
] as const;

export type TipoSangre = (typeof TIPOS_SANGRE)[number];

export const ContactoEmergenciaSchema = z.object({
  nombre: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede exceder los 200 caracteres'),
  relacion: z
    .string()
    .min(2, 'La relación debe tener al menos 2 caracteres')
    .max(100, 'La relación no puede exceder los 100 caracteres'),
  telefonoWhatsApp: z
    .string()
    .regex(/^\+593\d{9}$/, 'Debe ser un número de Ecuador válido (+593...)'),
});

export const PerfilDependienteSchema = z.object({
  nombreCompleto: z
    .string()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres')
    .max(200, 'El nombre completo no puede exceder los 200 caracteres'),
    tipoSangre: z.enum(TIPOS_SANGRE, 'El tipo de sangre es obligatorio o inválido'),
  condicionesCronicas: z
    .string()
    .max(4000, 'Las condiciones crónicas no pueden exceder los 4000 caracteres'),
  alergiasEstructuradas: z
    .array(
      z
        .string()
        .min(1, 'Cada alergia no puede estar vacía')
        .max(100, 'Cada alergia no puede exceder los 100 caracteres')
    )
    .max(50, 'No se pueden registrar más de 50 alergias'),
  contactosEmergencia: z
    .array(ContactoEmergenciaSchema)
    .max(3, 'Máximo 3 contactos de emergencia'),
});

export type ContactoEmergenciaForm = z.infer<typeof ContactoEmergenciaSchema>;
export type PerfilDependienteForm = z.infer<typeof PerfilDependienteSchema>;
