import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Boton } from '../../components/Boton';
import { crearBloqueSchema, editarBloqueSchema } from './schema';
import type { RACPDBackendFeaturesAgendaBloqueTurnoDto } from '../../api/generated/model';

interface FormData {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cuposMaximos: number;
  descripcion?: string;
}

interface DialogoBloqueProps {
  abierto: boolean;
  bloque?: RACPDBackendFeaturesAgendaBloqueTurnoDto | null;
  onCerrar: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  isMutating: boolean;
  apiError?: string | null;
}

const hoy = new Date().toISOString().split('T')[0];

export const DialogoBloque = ({
  abierto,
  bloque,
  onCerrar,
  onSubmit,
  isMutating,
  apiError,
}: DialogoBloqueProps) => {
  const isEditing = !!bloque;

  const form = useForm<FormData>({
    resolver: zodResolver(isEditing ? editarBloqueSchema : crearBloqueSchema),
    defaultValues: {
      fecha: hoy,
      horaInicio: '08:00',
      horaFin: '14:00',
      cuposMaximos: 1,
      descripcion: '',
    },
  });

  useEffect(() => {
    if (abierto) {
      if (bloque) {
        form.reset({
          fecha: bloque.fecha || hoy,
          horaInicio: bloque.horaInicio?.slice(0, 5) || '08:00',
          horaFin: bloque.horaFin?.slice(0, 5) || '14:00',
          cuposMaximos: bloque.cuposMaximos || 1,
          descripcion: bloque.descripcion || '',
        });
      } else {
        form.reset({
          fecha: hoy,
          horaInicio: '08:00',
          horaFin: '14:00',
          cuposMaximos: 1,
          descripcion: '',
        });
      }
    }
  }, [abierto, bloque, form]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCerrar}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-blue-900">
            {isEditing ? 'Editar Bloque' : 'Crear Bloque de Turno'}
          </h2>
          <button
            onClick={onCerrar}
            disabled={isMutating}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4">
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {apiError}
            </div>
          )}

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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 cursor-pointer"
            />
            {form.formState.errors.fecha && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.fecha.message as string}</p>
            )}
          </div>

          {/* Hora Inicio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora Inicio
              </label>
              <input
                type="time"
                {...form.register('horaInicio')}
                disabled={isMutating}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 cursor-pointer"
              />
              {form.formState.errors.horaInicio && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.horaInicio.message as string}</p>
              )}
            </div>

            {/* Hora Fin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora Fin
              </label>
              <input
                type="time"
                {...form.register('horaFin')}
                disabled={isMutating}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 cursor-pointer"
              />
              {form.formState.errors.horaFin && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.horaFin.message as string}</p>
              )}
            </div>
          </div>

          {/* Cupos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cupos disponibles
            </label>
            <select
              {...form.register('cuposMaximos', { valueAsNumber: true })}
              disabled={isMutating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 cursor-pointer"
            >
              <option value={1}>1 cupo</option>
              <option value={2}>2 cupos</option>
              <option value={3}>3 cupos</option>
              <option value={4}>4 cupos</option>
              <option value={5}>5 cupos</option>
            </select>
            {form.formState.errors.cuposMaximos && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.cuposMaximos.message as string}</p>
            )}
          </div>

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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none disabled:opacity-50"
            />
            {form.formState.errors.descripcion && (
              <p className="text-red-500 text-sm mt-1">{form.formState.errors.descripcion.message as string}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Boton
              type="button"
              variante="secundario"
              onClick={onCerrar}
              disabled={isMutating}
              className="flex-1 cursor-pointer"
            >
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={isMutating}
              className="flex-1 cursor-pointer"
            >
              {isEditing ? 'Guardar' : 'Crear'}
            </Boton>
          </div>
        </form>
      </div>
    </div>
  );
};
