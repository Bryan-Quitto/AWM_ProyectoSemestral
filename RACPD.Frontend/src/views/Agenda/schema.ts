import { z } from 'zod';

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const hoy = new Date().toISOString().split('T')[0];

export const crearBloqueSchema = z.object({
  fecha: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (YYYY-MM-DD)')
    .refine(d => d >= hoy, 'No se pueden crear bloques en fechas pasadas'),
  horaInicio: z.string()
    .regex(horaRegex, 'Formato HH:mm inválido'),
  horaFin: z.string()
    .regex(horaRegex, 'Formato HH:mm inválido'),
  cuposMaximos: z.number().min(1).max(5),
  descripcion: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
}).refine(
  data => {
    const [hiH, hiM] = data.horaInicio.split(':').map(Number);
    const [hfH, hfM] = data.horaFin.split(':').map(Number);
    const inicioMinutos = hiH * 60 + hiM;
    const finMinutos = hfH * 60 + hfM;
    return finMinutos > inicioMinutos;
  },
  { message: 'La hora de fin debe ser posterior a la de inicio', path: ['horaFin'] }
);

export const editarBloqueSchema = crearBloqueSchema;

export type CrearBloqueFormData = z.infer<typeof crearBloqueSchema>;
export type EditarBloqueFormData = z.infer<typeof editarBloqueSchema>;

export const filtrosAgenda = ['Todos', 'MisBloques', 'MisReservas', 'Disponibles'] as const;
export type FiltroAgenda = typeof filtrosAgenda[number];
