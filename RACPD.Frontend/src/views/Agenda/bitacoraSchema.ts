import { z } from 'zod';

/**
 * Schema de la Bitacora al cerrar un turno.
 * Persona 3 / Semana 2.
 *
 * Coincide con el DTO del backend (CompletarTurnoEndpoint):
 *  - EstadoAnimo es el unico campo obligatorio (debe estar presente).
 *  - Sintomas / ObservacionesGenerales / HorasSueno / Tareas son opcionales.
 *
 * Conversiones de Zod a backend:
 *   EstadoAnimo: enum C# -> string (HasConversion<string>).
 *   TareasRealizadasIds: List<UUID> backend -> string[] GUID en JSON.
 */
export const estadoAnimoBitacoraEnum = z.enum([
  'MuyBien',
  'Bien',
  'Neutral',
  'Mal',
  'MuyMal',
]);
export type EstadoAnimoBitacora = z.infer<typeof estadoAnimoBitacoraEnum>;

export const ETIQUETAS_ESTADO_ANIMO: Record<EstadoAnimoBitacora, string> = {
  MuyBien: 'Muy bien',
  Bien: 'Bien',
  Neutral: 'Neutral',
  Mal: 'Mal',
  MuyMal: 'Muy mal',
};

export const completarBitacoraSchema = z.object({
  estadoAnimo: estadoAnimoBitacoraEnum,
  sintomas: z
    .string()
    .max(1000, 'Maximo 1000 caracteres')
    .optional()
    .or(z.literal('')),
  horasSueno: z
    .number({ error: 'Debe ser un numero entre 0 y 24' })
    .min(0, 'Minimo 0 horas')
    .max(24, 'Maximo 24 horas')
    .optional(),
  observacionesGenerales: z
    .string()
    .max(2000, 'Maximo 2000 caracteres')
    .optional()
    .or(z.literal('')),
  tareasRealizadasIds: z.array(z.string().uuid()).optional(),
});

export type CompletarBitacoraFormData = z.infer<typeof completarBitacoraSchema>;