import { Download, Smartphone, X } from 'lucide-react';
import { useInstalacionPwa } from '../features/pwa/useInstalacionPwa';

/**
 * Banner de Hardening PWA que captura `beforeinstallprompt`
 * e invita a instalar la aplicación RACPD en el dispositivo.
 */
export function BannerInstalarPwa() {
  const { mostrarBanner, instalando, instalar, descartar } = useInstalacionPwa();

  if (!mostrarBanner) return null;

  return (
    <aside
      role="region"
      aria-label="Instalar aplicación RACPD"
      className="mx-3 mt-3 mb-1 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-blue-50 p-3.5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-blue-950">Instalar App RACPD</p>
          <p className="mt-0.5 text-xs text-blue-800/80 leading-snug">
            Accede al botón SOS y a los datos críticos sin conexión desde tu pantalla de inicio.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void instalar()}
              disabled={instalando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {instalando ? 'Instalando…' : 'Instalar App'}
            </button>
            <button
              type="button"
              onClick={descartar}
              disabled={instalando}
              className="rounded-xl px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100/70 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={descartar}
          disabled={instalando}
          aria-label="Cerrar aviso de instalación"
          className="rounded-lg p-1 text-blue-500 transition hover:bg-blue-100 hover:text-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
