import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Boton } from '../../components/Boton';
import { BuscadorDinamico, type OpcionBuscador } from '../../components/BuscadorDinamico';
import { SelectorDinamico } from '../../components/SelectorDinamico';
import { useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint } from '../../api/generated/api/api';
import {
  bloqueFormSchema,
  type BloqueFormData,
  type TareaFormValue,
} from './schema';
import { ChecklistTareas } from './ChecklistTareas';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';

interface DialogoCrearBloqueProps {
  abierto: boolean;
  modo: 'crear' | 'editar';
  bloque?: RACPDBackendFeaturesAgendaBloqueTurnoDto | null;
  onCerrar: () => void;
  onSubmit: (data: BloqueFormData) => Promise<void>;
  isMutating: boolean;
  apiError?: string | null;
}

const hoy = new Date().toISOString().split('T')[0];

export const DialogoCrearBloque = ({
  abierto,
  modo,
  bloque,
  onCerrar,
  onSubmit,
  isMutating,
  apiError,
}: DialogoCrearBloqueProps) => {
  const esEdicion = modo === 'editar';

  const form = useForm<BloqueFormData>({
    resolver: zodResolver(bloqueFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      fecha: hoy,
      horaInicio: '08:00',
      horaFin: '14:00',
      cuposMaximos: 1,
      descripcion: '',
      perfilDependienteId: '',
      tipoRecurrencia: 'Unica',
      intervaloSemanas: undefined,
      tareas: [],
    },
  });

  // Selector de dependientes (fuse.js) — tenancy garantizada por el endpoint.
  const { data: dataDependientes } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint({
      swr: { dedupingInterval: 60_000, revalidateOnFocus: false },
    });

  const opcionesDependientes: OpcionBuscador[] = useMemo(() => {
    const lista = (dataDependientes?.data ?? []) as Array<{
      perfilId?: string;
      nombreCompleto?: string;
      rolEnDependiente?: string;
    }>;
    // RF-1 / BOLA: el backend rechaza con 403 cualquier intento de crear
    // un bloque sobre un dependiente donde el usuario no sea CuidadorPrincipal.
    // Filtramos aquí para evitar mostrar opciones que el servidor nunca aceptará.
    return lista
      .filter((d) => d.perfilId && d.rolEnDependiente === 'CuidadorPrincipal')
      .map((d) => ({
        valor: d.perfilId as string,
        etiqueta: d.nombreCompleto ?? 'Sin nombre',
        subtexto: 'Cuidador principal',
      }));
  }, [dataDependientes]);

  // Recurrencia dinámica
  const tipoRecurrencia = useWatch({
    control: form.control,
    name: 'tipoRecurrencia',
  });

  // Hidratar el form cuando se abre / cambia el bloque a editar.
  // Usamos useEffect + ref para evitar set-state en render (regla React Compiler).
  const ultimoBloqueIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!abierto) {
      ultimoBloqueIdRef.current = null;
      return;
    }

    if (esEdicion && bloque) {
      if (ultimoBloqueIdRef.current === bloque.id) return;
      ultimoBloqueIdRef.current = bloque.id ?? null;

      form.reset({
        fecha: bloque.fecha || hoy,
        horaInicio: bloque.horaInicio?.slice(0, 5) || '08:00',
        horaFin: bloque.horaFin?.slice(0, 5) || '14:00',
        cuposMaximos: bloque.cuposMaximos || 1,
        descripcion: bloque.descripcion || '',
        perfilDependienteId: bloque.perfilDependienteId || '',
        tipoRecurrencia:
          (bloque.tipoRecurrencia as 'Unica' | 'Indefinida' | 'Semanas') || 'Unica',
        intervaloSemanas: bloque.intervaloSemanas ?? undefined,
        tareas: ((bloque.tareas ?? []) as Array<{
          id?: string;
          descripcion?: string;
          orden?: number;
        }>).map((t) => ({
          id: t.id ?? crypto.randomUUID(),
          descripcion: t.descripcion ?? '',
          orden: t.orden ?? 0,
        })),
      });
    } else if (!esEdicion) {
      if (ultimoBloqueIdRef.current === '__nuevo__') return;
      ultimoBloqueIdRef.current = '__nuevo__';
      form.reset({
        fecha: hoy,
        horaInicio: '08:00',
        horaFin: '14:00',
        cuposMaximos: 1,
        descripcion: '',
        perfilDependienteId: '',
        tipoRecurrencia: 'Unica',
        intervaloSemanas: undefined,
        tareas: [],
      });
    }
  }, [abierto, bloque, esEdicion, form]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay decorativo: NO cierra el diálogo al hacer clic fuera.
          Solo se cierra por la X, el botón "Cancelar" o el submit.
          Esto evita pérdida accidental de datos del cuidador. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-blue-900">
            {esEdicion ? 'Editar bloque de turno' : 'Crear bloque de turno'}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            disabled={isMutating}
            aria-label="Cerrar"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="p-4 space-y-4 overflow-y-auto flex-1"
        >
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {apiError}
            </div>
          )}

          {/* Dependiente */}
          <Controller
            control={form.control}
            name="perfilDependienteId"
            render={({ field, fieldState }) => (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dependiente
                </label>
                <BuscadorDinamico
                  id="perfilDependienteId"
                  opciones={opcionesDependientes}
                  value={field.value ?? ''}
                  onChange={(v) => {
                    field.onChange(String(v));
                    void form.trigger('perfilDependienteId');
                  }}
                  onBlur={field.onBlur}
                  placeholder="Buscar dependiente…"
                  disabled={isMutating}
                  error={fieldState.error?.message}
                  emptyMessage={
                    opcionesDependientes.length === 0
                      ? 'Aún no tienes dependientes asignados.'
                      : 'Sin coincidencias.'
                  }
                />
                {fieldState.error?.message && (
                  <p className="text-red-500 text-sm mt-1">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              {...form.register('fecha')}
              min={hoy}
              disabled={isMutating}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none transition disabled:opacity-50 cursor-pointer ${
                form.formState.errors.fecha
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {form.formState.errors.fecha && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.fecha.message as string}
              </p>
            )}
          </div>

          {/* Hora Inicio / Hora Fin */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora inicio
              </label>
              <input
                type="time"
                {...form.register('horaInicio')}
                disabled={isMutating}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none transition disabled:opacity-50 cursor-pointer ${
                  form.formState.errors.horaInicio
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {form.formState.errors.horaInicio && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.horaInicio.message as string}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora fin
              </label>
              <input
                type="time"
                {...form.register('horaFin')}
                disabled={isMutating}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none transition disabled:opacity-50 cursor-pointer ${
                  form.formState.errors.horaFin
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {form.formState.errors.horaFin && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.horaFin.message as string}
                </p>
              )}
            </div>
          </div>

          {/* Cupos */}
          <Controller
            control={form.control}
            name="cuposMaximos"
            render={({ field, fieldState }) => (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cupos disponibles
                </label>
                <SelectorDinamico
                  id="cuposMaximos"
                  opciones={[
                    { valor: 1, etiqueta: '1 cupo' },
                    { valor: 2, etiqueta: '2 cupos' },
                    { valor: 3, etiqueta: '3 cupos' },
                    { valor: 4, etiqueta: '4 cupos' },
                    { valor: 5, etiqueta: '5 cupos' },
                  ]}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  disabled={isMutating}
                  error={fieldState.error?.message}
                />
                {fieldState.error?.message && (
                  <p className="text-red-500 text-sm mt-1">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Recurrencia */}
          <Controller
            control={form.control}
            name="tipoRecurrencia"
            render={({ field, fieldState }) => (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recurrencia
                </label>
                <SelectorDinamico
                  id="tipoRecurrencia"
                  opciones={[
                    { valor: 'Unica', etiqueta: 'Una sola vez' },
                    { valor: 'Indefinida', etiqueta: 'Indefinida' },
                    { valor: 'Semanas', etiqueta: 'Cada N semanas' },
                  ]}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(String(v));
                    // Evita bloqueo: si el usuario sale de "Semanas" mientras
                    // había un valor en `intervaloSemanas`, el input se desmonta
                    // pero RHF retiene el valor en memoria → Zod marcaría error
                    // sobre un campo invisible. Limpiamos al cambiar.
                    if (v !== 'Semanas') {
                      form.setValue('intervaloSemanas', undefined, {
                        shouldValidate: true,
                      });
                    }
                  }}
                  disabled={isMutating}
                  error={fieldState.error?.message}
                />
                {fieldState.error?.message && (
                  <p className="text-red-500 text-sm mt-1">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          {/* Intervalo condicional */}
          {tipoRecurrencia === 'Semanas' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Intervalo (semanas)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                {...form.register('intervaloSemanas', { valueAsNumber: true })}
                disabled={isMutating}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none transition disabled:opacity-50 cursor-pointer ${
                  form.formState.errors.intervaloSemanas
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {form.formState.errors.intervaloSemanas && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.intervaloSemanas.message as string}
                </p>
              )}
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              {...form.register('descripcion')}
              disabled={isMutating}
              rows={2}
              placeholder="Ej: Turno de mañana con soporte de enfermería"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none disabled:opacity-50 cursor-pointer"
            />
            {form.formState.errors.descripcion && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.descripcion.message as string}
              </p>
            )}
          </div>

          {/* Checklist de tareas */}
          <Controller
            control={form.control}
            name="tareas"
            render={({ field }) => (
              <ChecklistTareas
                tareas={(field.value ?? []) as TareaFormValue[]}
                onChange={(tareas) => {
                  field.onChange(tareas);
                  void form.trigger('tareas');
                }}
                disabled={isMutating}
              />
            )}
          />
          {form.formState.errors.tareas && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.tareas.message as string}
            </p>
          )}
        </form>

        <div className="flex gap-3 p-4 border-t border-gray-100 bg-gray-50">
          <Boton
            type="button"
            variante="secundario"
            onClick={onCerrar}
            disabled={isMutating}
            className="flex-1 cursor-pointer disabled:cursor-not-allowed"
          >
            Cancelar
          </Boton>
          <Boton
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            cargando={isMutating}
            className="flex-1 cursor-pointer disabled:cursor-not-allowed"
          >
            {esEdicion ? 'Guardar' : 'Crear'}
          </Boton>
        </div>
      </div>
    </div>
  );
};
