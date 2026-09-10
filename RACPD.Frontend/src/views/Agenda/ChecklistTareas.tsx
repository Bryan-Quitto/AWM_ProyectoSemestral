import { useState } from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';
import type { TareaFormValue } from './schema';

interface ChecklistTareasProps {
  tareas: TareaFormValue[];
  onChange: (tareas: TareaFormValue[]) => void;
  disabled?: boolean;
}

/**
 * Checklist dinámica de tareas para el bloque de turno.
 * Componente de DOMINIO (spec 006 §6.2) — vive en views/Agenda/ porque
 * está atado al flujo "crear/editar bloque", no es UI agnóstica.
 *
 * Estado derivado: NO usa useEffect para sincronizar — el padre controla
 * el array vía `onChange` y el input local solo refleja el "borrador".
 */
export const ChecklistTareas = ({
  tareas,
  onChange,
  disabled = false,
}: ChecklistTareasProps) => {
  const [borrador, setBorrador] = useState('');

  const handleAgregar = () => {
    const descripcion = borrador.trim();
    if (!descripcion) return;
    if (tareas.length >= 20) return;

    const nuevaTarea: TareaFormValue = {
      id: crypto.randomUUID(),
      descripcion,
      orden: tareas.length,
    };
    onChange([...tareas, nuevaTarea]);
    setBorrador('');
  };

  const handleEliminar = (id: string) => {
    onChange(
      tareas
        .filter((t) => t.id !== id)
        .map((t, idx) => ({ ...t, orden: idx })),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAgregar();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-blue-500" />
        Tareas del bloque
        <span className="text-xs text-gray-500 font-normal">
          ({tareas.length}/20)
        </span>
      </label>

      {/* Input + botón agregar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || tareas.length >= 20}
          maxLength={200}
          placeholder="Ej: Administrar medicación de las 08:00"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed text-sm"
        />
        <button
          type="button"
          onClick={handleAgregar}
          disabled={disabled || !borrador.trim() || tareas.length >= 20}
          aria-label="Agregar tarea"
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Lista */}
      {tareas.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {tareas.map((tarea, idx) => (
            <li
              key={tarea.id ?? `tarea-${idx}`}
              className="flex items-center gap-2 p-2 bg-blue-50/50 border border-blue-100 rounded-lg text-sm"
            >
              <span className="flex-1 text-gray-700 truncate">
                {tarea.descripcion}
              </span>
              <button
                type="button"
                onClick={() => tarea.id && handleEliminar(tarea.id)}
                disabled={disabled || !tarea.id}
                aria-label={`Eliminar tarea: ${tarea.descripcion}`}
                className="p-1 text-red-500 hover:bg-red-100 rounded transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
