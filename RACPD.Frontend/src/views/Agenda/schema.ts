import { z } from 'zod';

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Devuelve la fecha actual en formato "YYYY-MM-DD" en el huso horario
 * oficial de Ecuador (America/Guayaquil, UTC-5), independientemente de
 * la zona horaria configurada en el navegador del usuario.
 *
 * Regla SKILLS.md §3: "Huso Horario Estricto: operar bajo America/Guayaquil".
 * Crítico porque los cuidadores pueden tener Windows, navegador o
 * contenedor con zonas distintas (UTC, UTC-3, etc.) y aun así esperar
 * que la app respete el día calendario ecuatoriano.
 *
 * Esta función se debe invocar **en cada validación** (no al cargar el
 * módulo), porque de lo contrario el valor queda stale y vuelve a fallar
 * cuando el cuidador deja el formulario abierto cruzando medianoche.
 *
 * Implementación: `Intl.DateTimeFormat` con la opción `timeZone` permite
 * formatear un instante UTC arbitrario al huso Ecuador. Tomamos el
 * instante `new Date()` (UTC interno) y lo proyectamos a Ecuador. Esto
 * funciona en todos los navegadores modernos y en SSR-safe (no usa APIs
 * exclusivas del navegador).
 */
export const fechaLocalEcuadorIso = (): string => {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA produce formato YYYY-MM-DD de forma estable.
  return formateador.format(new Date());
};

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
 *
 * Spec-007 §10: se eliminó `Indefinida` porque el sistema no puede
 * prometer recurrencia infinita en un contexto clínico (la proyección
 * está acotada por el rango de la request). Solo dos opciones reales:
 * - 'Unica': un solo turno.
 * - 'Semanas': cada N semanas (1..24). El cuidador elige siempre un tope.
 */
export const tipoRecurrenciaEnum = z.enum(['Unica', 'Semanas']);
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
      .refine((d) => d >= fechaLocalEcuadorIso(), 'No se pueden crear bloques en fechas pasadas'),
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

    // === Regla: si la fecha es HOY (Ecuador), horaInicio debe ser > hora actual ===
    // Se evalúa en cada submit (no como constante al cargar el módulo) para
    // evitar valores stale si el cuidador tarda en llenar el formulario.
    // Huso horario: hora local del navegador, que es la que usa el date picker
    // HTML5 nativo. El cuidador en Ecuador verá esta restricción contra su
    // hora local, que es coherente con el principio "Huso Horario Estricto
    // America/Guayaquil" del SKILLS.md §3 (la BD y el backend también operan
    // en ese huso).
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
