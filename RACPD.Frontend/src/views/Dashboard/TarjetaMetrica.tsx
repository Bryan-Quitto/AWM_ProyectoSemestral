import type { LucideIcon } from 'lucide-react';

export type TonoKpi = 'primario' | 'exito' | 'alerta' | 'sistema';

interface TarjetaMetricaProps {
  etiqueta: string;
  valor: string | number;
  subtexto?: string;
  icono: LucideIcon;
  tono?: TonoKpi;
  /** Si true, renderiza esqueletos animate-pulse en lugar del contenido (Zero-Wait). */
  cargando?: boolean;
}

const TONOS_CONTENEDOR: Record<TonoKpi, string> = {
  primario: 'bg-blue-50 text-blue-900 border-blue-100',
  exito: 'bg-emerald-50 text-emerald-900 border-emerald-100',
  alerta: 'bg-amber-50 text-amber-900 border-amber-100',
  sistema: 'bg-sky-50 text-sky-900 border-sky-100',
};

const TONOS_ICONO: Record<TonoKpi, string> = {
  primario: 'bg-blue-100 text-blue-700',
  exito: 'bg-emerald-100 text-emerald-700',
  alerta: 'bg-amber-100 text-amber-700',
  sistema: 'bg-sky-100 text-sky-700',
};

/**
 * TarjetaMetrica
 *
 * Componente de métrica KPI reutilizable para el Dashboard. UI ligada a la
 * vista `/Dashboard/`, NO se sube a `src/components/` porque solo se usa aquí
 * (Regla de 3 del proyecto: 4 invocaciones, pero todas en el mismo feature).
 *
 * Si en el futuro se usa desde otra vista, promover a `src/components/`.
 */
export const TarjetaMetrica = ({
  etiqueta,
  valor,
  subtexto,
  icono: Icono,
  tono = 'primario',
  cargando = false,
}: TarjetaMetricaProps) => {
  const clasesCaja = `${TONOS_CONTENEDOR[tono]} border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`;
  const clasesIcono = `${TONOS_ICONO[tono]} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`;

  if (cargando) {
    return (
      <div
        className={`${clasesCaja} animate-pulse`}
        aria-busy="true"
        aria-label={`Cargando ${etiqueta}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-current opacity-20 rounded" />
            <div className="h-7 w-16 bg-current opacity-30 rounded" />
            <div className="h-3 w-28 bg-current opacity-20 rounded" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-current opacity-20" />
        </div>
      </div>
    );
  }

  return (
    <div className={clasesCaja}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80 truncate">
            {etiqueta}
          </p>
          <p className="mt-2 text-3xl font-bold leading-none">{valor}</p>
          {subtexto && (
            <p className="mt-2 text-sm opacity-80 truncate" title={subtexto}>
              {subtexto}
            </p>
          )}
        </div>
        <div className={clasesIcono} aria-hidden="true">
          <Icono className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
