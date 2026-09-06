import { useLayoutEffect, useRef, useState } from 'react';

export interface TruncadorLineaProps {
  /** Texto a mostrar. Si está vacío se renderiza sólo el placeholder. */
  texto: string;
  /** Número máximo de líneas (default 1). */
  maxLineas?: number;
  /** Placeholder cuando el texto está vacío. Si no se define, se renderiza nada. */
  placeholderVacio?: string;
  /** Callback al hacer clic en los "..." (sólo se dispara si hay overflow). */
  onExpand?: () => void;
  className?: string;
}

/**
 * TruncadorLinea: muestra `texto` truncado a `maxLineas` líneas con elipsis "…"
 * en negrita y con cursor-pointer. Al hacer clic en "…" se invoca `onExpand`.
 *
 * Detecta overflow comparando scrollHeight/clientHeight (o scrollWidth/clientWidth
 * cuando maxLineas === 1) tras cada cambio de tamaño del contenedor.
 *
 * - No depende de librerías externas.
 * - Estilo coherente con la paleta azul/celeste del proyecto.
 * - `cursor-pointer` y `font-bold` en el "…" para indicar interactividad.
 */
export const TruncadorLinea = ({
  texto,
  maxLineas = 1,
  placeholderVacio,
  onExpand,
  className = '',
}: TruncadorLineaProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [tieneOverflow, setTieneOverflow] = useState(false);

  // Detecta overflow usando ResizeObserver (cubre cambios de viewport y de contenido).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const checkOverflow = () => {
      const overflow =
        maxLineas === 1
          ? el.scrollWidth > el.clientWidth
          : el.scrollHeight > el.clientHeight;
      setTieneOverflow(overflow);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [texto, maxLineas]);

  const handleExpand = () => {
    if (tieneOverflow && onExpand) onExpand();
  };

  if (!texto) {
    if (!placeholderVacio) return null;
    return (
      <span className={`text-gray-400 italic ${className}`}>{placeholderVacio}</span>
    );
  }

  const clampClass =
    maxLineas === 1
      ? 'truncate whitespace-nowrap overflow-hidden'
      : `overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:${maxLineas}]`;

  // Renderizamos el "…" FUERA del span truncado para garantizar que sea visible
  // y clickable. Cuando hay overflow, queda justo a la derecha (o debajo, según
  // line-clamp) del texto recortado.
  //
  // IMPORTANTE: el wrapper es `block min-w-0 flex-1` (no inline) para que respete
  // el ancho disponible del padre flex y no desborde horizontalmente. `min-w-0`
  // es necesario porque por defecto los flex items tienen `min-width: auto`,
  // lo que permite al hijo crecer más allá del contenedor y romper el card.
  return (
    <span className={`block min-w-0 flex-1 ${className}`}>
      <span ref={ref} className={`${clampClass} block`}>
        {texto}
      </span>
      {tieneOverflow && (
        <button
          type="button"
          onClick={handleExpand}
          className="cursor-pointer font-bold text-blue-700 hover:text-blue-900 ml-0.5 align-baseline"
          aria-label="Ver contenido completo"
        >
          …
        </button>
      )}
    </span>
  );
};

TruncadorLinea.displayName = 'TruncadorLinea';