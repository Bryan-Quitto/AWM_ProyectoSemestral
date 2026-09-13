import { z } from 'zod';

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const hoy = new Date().toISOString().split('T')[0];

/**
 * Ítem individual de la checklist de tareas del bloque.
 * Reglas (alineadas con el spec 006):
 * - descripcion: 1..200 chars
 * - orden: entero >= 0
 * - id: opcional (el backend lo genera si se omite)
 */
export const tareaSchema = z.object({
  id: z.string().uuid().optional(),
  descripcion: z
    .string()
    .trim()
    .min(1, 'La tarea no puede estar vacía')
    .max(200, 'Máximo 200 caracteres'),
  orden: z.number().int().min(0).max(99),
});

export type TareaFormValue = z.infer<typeof tareaSchema>;

/**
 * Tipos de recurrencia válidos. Coinciden con el enum backend
 * `RACPD.Backend.Domain.Enums.TipoRecurrencia`.
 */
export const tipoRecurrenciaEnum = z.enum(['Unica', 'Indefinida', 'Semanas']);
export type TipoRecurrencia = z.infer<typeof tipoRecurrenciaEnum>;

/**
 * Esquema unificado de creación/edición de un bloque de turno (spec 006).
 * Persona 1 / Semana 1 — incluye:
 * - perfilDependienteId (RF-1 tenancy clínica)
 * - tipoRecurrencia + intervaloSemanas (validación cruzada)
 * - tareas (checklist)
 */
export const bloqueFormSchema = z
  .object({
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido')
      .refine((d) => d >= hoy, 'No se pueden crear bloques en fechas pasadas'),
    horaInicio: z.string().regex(horaRegex, 'Formato HH:mm inválido'),
    horaFin: z.string().regex(horaRegex, 'Formato HH:mm inválido'),
    cuposMaximos: z.number().int().min(1).max(5),
    descripcion: z
      .string()
      .max(200, 'Máximo 200 caracteres')
      .optional()
      .or(z.literal('')),
    perfilDependienteId: z.string().uuid('Debe seleccionar un dependiente'),
    tipoRecurrencia: tipoRecurrenciaEnum,
    intervaloSemanas: z
      .number({ error: 'Debe ingresar un número de semanas válido' })
      .int('Debe ser un número entero')
      .min(1, 'Debe ser al menos 1 semana')
      .max(24, 'No puede superar las 24 semanas')
      .optional()
      .or(z.nan()),
    tareas: z
      .array(tareaSchema)
      .min(1, 'Debe agregar al menos una tarea para el bloque de turno')
      .max(20, 'Máximo 20 tareas permitidas'),
  })
  .superRefine((val, ctx) => {
    if (
      val.tipoRecurrencia === 'Semanas' &&
      (!val.intervaloSemanas ||
        val.intervaloSemanas < 1 ||
        val.intervaloSemanas > 24)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe especificar un intervalo entre 1 y 24 semanas',
        path: ['intervaloSemanas'],
      });
    }
    if (
      val.tipoRecurrencia !== 'Semanas' &&
      val.intervaloSemanas !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El intervalo solo aplica para recurrencia semanal',
        path: ['intervaloSemanas'],
      });
    }
    if (val.horaInicio && val.horaFin && val.horaFin <= val.horaInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La hora de fin debe ser posterior a la hora de inicio',
        path: ['horaFin'],
      });
    }

    // === Regla: si la fecha es HOY, horaInicio debe ser > hora actual del cliente ===
    // new Date() se evalua aqui (en cada submit), no como constante al cargar el modulo,
    // para evitar valores stale si el usuario tarda en llenar el formulario.
    // El huso horario es el del navegador del usuario, coherente con
    // "Huso Horario Estricto America/Guayaquil" (regla del SKILLS.md).
    if (val.fecha && val.horaInicio) {
      const hoyCliente = new Date();
      const fechaCliente = new Date();
      const [anio, mes, dia] = val.fecha.split('-').map(Number);
      fechaCliente.setFullYear(anio, mes - 1, dia);

      const esHoy =
        fechaCliente.getFullYear() === hoyCliente.getFullYear() &&
        fechaCliente.getMonth() === hoyCliente.getMonth() &&
        fechaCliente.getDate() === hoyCliente.getDate();

      if (esHoy) {
        const [hh, mm] = val.horaInicio.split(':').map(Number);
        const horaInicioMinutos = hh * 60 + mm;
        const horaActualMinutos =
          hoyCliente.getHours() * 60 + hoyCliente.getMinutes();

        if (horaInicioMinutos <= horaActualMinutos) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La hora de inicio debe ser posterior a la hora actual',
            path: ['horaInicio'],
          });
        }
      }
    }
  });

export type BloqueFormData = z.infer<typeof bloqueFormSchema>;

/**
 * Alias semánticos para distinguir creación vs edición.
 * Ambos usan el mismo schema (mismas reglas), pero el tipo es útil
 * para el tipado de `DialogoCrearBloque`.
 */
export const crearBloqueSchema = bloqueFormSchema;
export const editarBloqueSchema = bloqueFormSchema;

export type CrearBloqueFormData = BloqueFormData;
export type EditarBloqueFormData = BloqueFormData;

export const filtrosAgenda = ['Todos', 'MisBloques', 'MisReservas', 'Disponibles'] as const;
export type FiltroAgenda = typeof filtrosAgenda[number];
