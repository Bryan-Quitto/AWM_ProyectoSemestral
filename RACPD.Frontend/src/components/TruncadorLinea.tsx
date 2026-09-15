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
 * - Soporta palabras continuas largas sin espacios (break-word / anywhere).
 * - Utiliza `-webkit-line-clamp` con CSS inline para no depender de clases inexistentes.
 * - Muestra `…` clickable si se pasa `onExpand` y se detecta overflow.
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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !onExpand) return;

    const checkOverflow = () => {
      // Si el elemento o un ancestro como <details> está oculto/cerrado, clientWidth es 0
      if (el.clientWidth === 0) return;

      if (maxLineas === 1) {
        setTieneOverflow(el.scrollWidth > el.clientWidth);
        return;
      }

      setTieneOverflow(el.scrollHeight > el.clientHeight);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [texto, maxLineas, onExpand]);

  if (!texto) {
    if (!placeholderVacio) return null;
    return (
      <span className={`text-gray-400 italic ${className}`}>{placeholderVacio}</span>
    );
  }

  const multiLineaStyle: React.CSSProperties =
    maxLineas === 1
      ? {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }
      : {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: maxLineas,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        };

  return (
    <span
      className={`block min-w-0 flex-1 ${className}`}
      onClick={onExpand}
      style={{ cursor: onExpand ? 'pointer' : undefined }}
    >
      <span ref={ref} style={multiLineaStyle} title={texto}>
        {texto}
      </span>
      {tieneOverflow && onExpand && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="cursor-pointer font-bold text-blue-700 hover:text-blue-900 ml-0.5 inline-block"
          aria-label="Ver contenido completo"
        >
          …
        </button>
      )}
    </span>
  );
};

TruncadorLinea.displayName = 'TruncadorLinea';