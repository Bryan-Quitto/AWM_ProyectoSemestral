import { useState } from 'react';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ClipboardList,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { Boton } from '../../components/Boton';
import {
  completarBitacoraSchema,
  ETIQUETAS_ESTADO_ANIMO,
  estadoAnimoBitacoraEnum,
  type CompletarBitacoraFormData,
  type EstadoAnimoBitacora,
} from './bitacoraSchema';
import { useCompletarTurno } from '../../features/agenda/hooks/useCompletarTurno';

/**
 * Persona 3 / Semana 2 — Modal para cerrar un turno con su Bitacora.
 *
 * Regla de 3: este modal se usa en UN solo lugar (al hacer clic en
 * "Completar turno" desde TarjetaBloque). Por eso NO se separa en
 * Desktop/Mobile: usamos el mismo archivo con clases responsive.
 *
 * Flujo:
 *  1. Checklist de tareas (BloqueTurno.Tareas). Marcar las realizadas.
 *  2. Form Bitacora: estadoAnimo (obligatorio), sintomas, horasSueno, observaciones.
 *  3. Boton "Cerrar turno" -> POST /api/agenda/{id}/completar.
 *  4. RFC 7807: si el backend rechaza (regla de negocio), mostramos toast.
 */

interface TareaBloque {
  id: string;
  descripcion: string;
  orden: number;
}

interface DialogoCompletarTurnoProps {
  abierto: boolean;
  bloqueId: string;
  tareas: TareaBloque[];
  /** Nombre del dependiente mostrado en el header (UX, no se envia al backend). */
  nombreDependiente: string;
  onCerrar: () => void;
  onCompletado: (bitacoraId: string) => void;
}

export const DialogoCompletarTurno = ({
  abierto,
  bloqueId,
  tareas,
  nombreDependiente,
  onCerrar,
  onCompletado,
}: DialogoCompletarTurnoProps) => {
  const { trigger: completar, isMutating } = useCompletarTurno();
  // Estado local de checklist (no va en RHF porque el backend lo recibe
  // como Lista de GUIDs ya resueltos al submit).
  const [tareasSeleccionadas, setTareasSeleccionadas] = useState<Set<string>>(new Set());

  const form = useForm<CompletarBitacoraFormData>({
    resolver: zodResolver(completarBitacoraSchema),
    defaultValues: {
      estadoAnimo: 'Neutral',
      sintomas: '',
      observacionesGenerales: '',
      tareasRealizadasIds: [],
    },
    mode: 'onChange',
  });

  // El reset del estado se debe manejar desmontando el modal desde el padre
  // usando el patrón `key={bloqueId}` para forzar un remount limpio, evitando
  // así el anti-patrón de sincronizar estado con useEffect en React 19.

  const toggleTarea = (tareaId: string) => {
    setTareasSeleccionadas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(tareaId)) siguiente.delete(tareaId);
      else siguiente.add(tareaId);
      return siguiente;
    });
  };

  const estadoAnimoSeleccionado = useWatch({ control: form.control, name: 'estadoAnimo' });

  const onSubmit: SubmitHandler<CompletarBitacoraFormData> = async (data) => {
    try {
      const respuesta: any = await completar({
        bloqueId,
        estadoAnimo: data.estadoAnimo,
        sintomas: data.sintomas || null,
        horasSueno: data.horasSueno ?? null,
        observacionesGenerales: data.observacionesGenerales || null,
        tareasRealizadasIds: Array.from(tareasSeleccionadas),
      });

      if (respuesta?.status >= 400) {
        const detalle = respuesta?.data?.detail ?? 'No se pudo cerrar el turno.';
        toast.error(detalle, { duration: 6000 });
        return;
      }

      toast.success('Turno cerrado correctamente.', {
        description: 'La bitacora fue guardada y el cuidador principal sera notificado.',
      });
      onCompletado(respuesta?.data?.bitacoraId);
      onCerrar();
    } catch (err: any) {
      const detalle = err?.response?.data?.detail
        ?? 'Error de conexion. Intente de nuevo.';
      toast.error(detalle, { duration: 6000 });
    }
  };

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-completar-titulo"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-blue-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <h2
              id="dialogo-completar-titulo"
              className="text-lg font-bold text-blue-900 flex items-center gap-2"
            >
              <ClipboardList size={18} />
              Cerrar turno
            </h2>
            <p className="text-sm text-blue-600 mt-1 truncate">
              {nombreDependiente}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={isMutating}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-1.5 rounded-full text-blue-700 hover:bg-blue-50 transition"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="p-5 space-y-5"
          noValidate
        >
          {/* === Checklist de tareas === */}
          {tareas.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-blue-900 mb-2">
                Tareas del turno
              </h3>
              <p className="text-xs text-blue-600 mb-3">
                Marca las tareas que completaste.
              </p>
              <ul className="space-y-2">
                {tareas.map((t) => {
                  const checked = tareasSeleccionadas.has(t.id);
                  return (
                    <li key={t.id}>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition
                          ${checked
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-blue-200 hover:border-blue-300 hover:bg-blue-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTarea(t.id)}
                          disabled={isMutating}
                          className="mt-0.5 cursor-pointer disabled:cursor-not-allowed accent-emerald-600"
                        />
                        <span
                          className={`text-sm ${checked ? 'line-through text-blue-500' : 'text-blue-900'}`}
                        >
                          {t.descripcion}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* === Estado de animo (obligatorio) === */}
          <section>
            <label
              htmlFor="estadoAnimo"
              className="block text-sm font-bold text-blue-900 mb-2"
            >
              Estado de animo del paciente <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {estadoAnimoBitacoraEnum.options.map((valor: EstadoAnimoBitacora) => {
                const seleccionado = estadoAnimoSeleccionado === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => form.setValue('estadoAnimo', valor, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })}
                    disabled={isMutating}
                    className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 py-2 px-1 rounded-xl border-2 text-xs font-medium transition
                      ${seleccionado
                        ? 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-blue-200 text-blue-700 hover:border-blue-300'}`}
                  >
                    {ETIQUETAS_ESTADO_ANIMO[valor]}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.estadoAnimo?.message && (
              <p className="text-xs text-red-500 mt-1.5">
                {form.formState.errors.estadoAnimo.message}
              </p>
            )}
          </section>

          {/* === Sintomas === */}
          <section>
            <label
              htmlFor="sintomas"
              className="block text-sm font-bold text-blue-900 mb-1"
            >
              Sintomas observados (opcional)
            </label>
            <textarea
              id="sintomas"
              rows={2}
              maxLength={1000}
              {...form.register('sintomas')}
              disabled={isMutating}
              placeholder="Ej: tos leve, sin fiebre..."
              className="w-full px-3 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-blue-500 mt-1">Max 1000 caracteres.</p>
          </section>

          {/* === Horas de sueno === */}
          <section>
            <label
              htmlFor="horasSueno"
              className="block text-sm font-bold text-blue-900 mb-1"
            >
              Horas de sueno (opcional)
            </label>
            <input
              id="horasSueno"
              type="number"
              min={0}
              max={24}
              step={0.5}
              {...form.register('horasSueno', { valueAsNumber: true })}
              disabled={isMutating}
              placeholder="Ej: 7.5"
              className="w-32 px-3 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {form.formState.errors.horasSueno?.message && (
              <p className="text-xs text-red-500 mt-1">
                {form.formState.errors.horasSueno.message}
              </p>
            )}
          </section>

          {/* === Observaciones generales === */}
          <section>
            <label
              htmlFor="observacionesGenerales"
              className="block text-sm font-bold text-blue-900 mb-1"
            >
              Observaciones generales (opcional)
            </label>
            <textarea
              id="observacionesGenerales"
              rows={3}
              maxLength={2000}
              {...form.register('observacionesGenerales')}
              disabled={isMutating}
              placeholder="Notas para el cuidador principal o el proximo relevo..."
              className="w-full px-3 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition resize-y disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-blue-500 mt-1">Max 2000 caracteres.</p>
          </section>

          <footer className="sticky bottom-0 bg-white pt-2 flex items-center justify-end gap-3">
            <Boton
              type="button"
              variante="secundario"
              onClick={onCerrar}
              disabled={isMutating}
              className="py-2.5 px-5 rounded-xl"
            >
              Cancelar
            </Boton>
            <Boton
              type="submit"
              disabled={isMutating || !form.formState.isValid}
              className="py-2.5 px-5 rounded-xl"
            >
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Cerrar turno
                </>
              )}
            </Boton>
          </footer>
        </form>
      </div>
    </div>
  );
};