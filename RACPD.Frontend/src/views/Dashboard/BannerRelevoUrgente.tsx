import { Link } from '@tanstack/react-router';
import { Siren, ArrowRight } from 'lucide-react';

interface BannerRelevoUrgenteProps {
  /** En Mobile el botón ocupa full-width (SPEC §4). */
  fullWidthBoton?: boolean;
}

/**
 * BannerRelevoUrgente
 *
 * Acceso rápido al Directorio de Relevos en caso de imprevistos.
 * Estático (no depende de SWR, SPEC §7) → siempre visible.
 */
export const BannerRelevoUrgente = ({ fullWidthBoton = false }: BannerRelevoUrgenteProps) => {
  return (
    <aside
      className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      role="complementary"
      aria-label="Acceso rápido a directorio de relevos"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Siren className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-base md:text-lg font-semibold text-amber-900">
            ¿Necesitas un relevo urgente?
          </p>
          <p className="text-sm text-amber-800/80">
            Contacta a tu red de cuidadores de confianza para cubrir un imprevisto.
          </p>
        </div>
      </div>
      <Link
        to="/directorio-relevos"
        className={`inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap ${
          fullWidthBoton ? 'w-full md:w-auto' : ''
        }`}
      >
        Abrir directorio
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </aside>
  );
};
