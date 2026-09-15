import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface OpcionBuscador {
  valor: string | number;
  etiqueta: string;
  /** Texto secundario opcional (ej. correo) que se muestra debajo de la etiqueta. */
  subtexto?: string;
}

export interface BuscadorDinamicoProps {
  id?: string;
  opciones: OpcionBuscador[];
  value?: string | number;
  onChange?: (valor: string | number) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  emptyMessage?: string;
}

const FUSE_OPTIONS: IFuseOptions<OpcionBuscador> = {
  keys: [
    { name: 'etiqueta', weight: 0.7 },
    { name: 'subtexto', weight: 0.3 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  isCaseSensitive: false,
};

/**
 * BuscadorDinamico: input text + dropdown filtrado en vivo mediante Fuse.js.
 *
 * Diseñado para ser consumido vía `Controller` de React Hook Form:
 *   <Controller
 *     name="usuarioId"
 *     control={form.control}
 *     render={({ field }) => (
 *       <BuscadorDinamico
 *         value={field.value ?? ''}
 *         onChange={(v) => field.onChange(v)}
 *       />
 *     )}
 *   />
 *
 * - No depende de la fuente de datos (las opciones las pasa el caller).
 * - Estilo consistente con `SelectorDinamico` (paleta azul/celeste/blanco).
 * - `cursor-pointer` y `disabled:cursor-not-allowed` en todos los estados.
 * - Cierra el dropdown con click-afuera o con Escape.
 */
export const BuscadorDinamico = ({
  id,
  opciones,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  className = '',
  placeholder = 'Buscar...',
  emptyMessage = 'Sin resultados.',
}: BuscadorDinamicoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const opcionSeleccionada = useMemo(
    () => opciones.find((op) => op.valor === value),
    [opciones, value]
  );

  // `queryOverride` representa lo que el usuario está tipeando. Cuando es null,
  // derivamos el texto del input desde el `value` externo (modo controlado puro).
  // Esto evita set-state-in-effect y mantiene la sincronización correcta.
  const [queryOverride, setQueryOverride] = useState<string | null>(null);
  const query =
    queryOverride !== null
      ? queryOverride
      : isOpen
        ? ''
        : opcionSeleccionada?.etiqueta ?? '';

  // Si el valor externo cambia respecto al último valor que vimos, descartamos
  // el override para que el componente vuelva a derivar desde la nueva selección.
  // Usamos un useState como "memoria del último valor conocido" para evitar
  // acceder refs durante render (regla oxlint).
  const [lastSeenValue, setLastSeenValue] = useState(value);
  if (lastSeenValue !== value) {
    setLastSeenValue(value);
    setQueryOverride(null);
  }

  const fuse = useMemo(() => new Fuse(opciones, FUSE_OPTIONS), [opciones]);

  const resultadosFiltrados = useMemo(() => {
    const q = query.trim();
    if (!q) return opciones.slice(0, 50);
    return fuse
      .search(q, { limit: 50 })
      .map((res) => res.item);
  }, [fuse, opciones, query]);

  // Cierra al hacer clic afuera y notifica blur
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [onBlur]);

  // Cierra con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleSelect = (op: OpcionBuscador) => {
    onChange?.(op.valor);
    setQueryOverride(op.etiqueta);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setQueryOverride('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const mostrarClear = !disabled && query.length > 0;

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div
        className={`
          w-full p-3 pr-10 bg-white border rounded-xl transition-all
          flex items-center gap-2
          focus-within:ring-2 focus-within:border-transparent
          ${disabled ? 'opacity-50 bg-gray-50' : ''}
          ${
            error
              ? 'border-red-300 focus-within:ring-red-500'
              : 'border-blue-200 focus-within:ring-blue-500'
          }
        `}
      >
        <Search
          className={`h-4 w-4 shrink-0 ${error ? 'text-red-400' : 'text-blue-500'}`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQueryOverride(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={opcionSeleccionada ? opcionSeleccionada.etiqueta : placeholder}
          autoComplete="off"
          className={`
            flex-1 min-w-0 bg-transparent outline-none text-sm
            ${disabled ? 'cursor-not-allowed' : 'cursor-text'}
            ${error ? 'text-red-900 placeholder:text-red-300' : 'text-gray-800 placeholder:text-gray-400'}
          `}
        />
        {mostrarClear && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
            className="text-gray-400 hover:text-gray-600 cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="pointer-events-none text-blue-500">
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-blue-100 py-1 max-h-60 overflow-auto">
          {resultadosFiltrados.length === 0 ? (
            <p className="py-3 px-4 text-sm text-gray-500 italic">{emptyMessage}</p>
          ) : (
            <ul className="focus:outline-none">
              {resultadosFiltrados.map((opcion) => {
                const isSelected = opcion.valor === value;
                return (
                  <li
                    key={opcion.valor}
                    onClick={() => handleSelect(opcion)}
                    className={`
                      cursor-pointer select-none relative py-2.5 pl-10 pr-4 transition-colors
                      ${isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'text-gray-700 hover:bg-blue-50/50 hover:text-blue-900'}
                    `}
                  >
                    <span className="block truncate text-sm">
                      {opcion.etiqueta}
                    </span>
                    {opcion.subtexto && (
                      <span className="block truncate text-xs text-gray-500">
                        {opcion.subtexto}
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                        <Check className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

BuscadorDinamico.displayName = 'BuscadorDinamico';