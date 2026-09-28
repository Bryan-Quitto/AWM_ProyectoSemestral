import React, { useState, useRef, useEffect } from 'react';
import { 
  Accessibility, 
  X, 
  RotateCcw, 
  Type, 
  SunMedium, 
  Palette, 
  Underline, 
  BookOpen, 
  Check 
} from 'lucide-react';
import { usePreferenciasAccesibilidad } from './usePreferenciasAccesibilidad';
import './estilosAccesibilidad.css';

export const BotonAccesibilidadFlotante: React.FC = () => {
  const [panelAbierto, setPanelAbierto] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonActivadorRef = useRef<HTMLButtonElement>(null);

  const {
    preferencias,
    totalModificacionesActivas,
    cambiarTamanoTexto,
    alternarAltoContraste,
    alternarEscalaGrises,
    alternarFuenteLegible,
    alternarSubrayarEnlaces,
    restablecerTodo,
  } = usePreferenciasAccesibilidad();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const manejarClicFuera = (evento: MouseEvent) => {
      if (
        panelAbierto &&
        panelRef.current &&
        !panelRef.current.contains(evento.target as Node) &&
        botonActivadorRef.current &&
        !botonActivadorRef.current.contains(evento.target as Node)
      ) {
        setPanelAbierto(false);
      }
    };

    const manejarTeclaEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && panelAbierto) {
        setPanelAbierto(false);
        botonActivadorRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', manejarClicFuera);
    document.addEventListener('keydown', manejarTeclaEscape);
    return () => {
      document.removeEventListener('mousedown', manejarClicFuera);
      document.removeEventListener('keydown', manejarTeclaEscape);
    };
  }, [panelAbierto]);

  return (
    <aside 
      aria-label="Panel de accesibilidad"
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto"
    >
      {/* Ventana Flotante de Opciones de Accesibilidad */}
      {panelAbierto && (
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-panel-accesibilidad"
          className="mb-3 w-80 sm:w-96 bg-white border border-blue-100 rounded-2xl shadow-2xl p-5 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4"
        >
          {/* Cabecera del Panel */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <Accessibility className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="titulo-panel-accesibilidad" className="text-base font-bold text-gray-900 leading-tight">
                  Accesibilidad
                </h2>
                <p className="text-xs text-gray-500">Adapta la interfaz a tus necesidades</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPanelAbierto(false)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              aria-label="Cerrar panel de accesibilidad"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Cuerpo con Opciones */}
          <div className="py-4 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* 1. Selector de Tamaño de Texto */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                Tamaño del Texto
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => cambiarTamanoTexto('normal')}
                  className={`cursor-pointer px-3 py-2 text-xs font-medium rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                    preferencias.tamanoTexto === 'normal'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-pressed={preferencias.tamanoTexto === 'normal'}
                >
                  <Type className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => cambiarTamanoTexto('grande')}
                  className={`cursor-pointer px-3 py-2 text-xs font-medium rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                    preferencias.tamanoTexto === 'grande'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-pressed={preferencias.tamanoTexto === 'grande'}
                >
                  <Type className="w-4 h-4" aria-hidden="true" />
                  <span>Grande</span>
                </button>
                <button
                  type="button"
                  onClick={() => cambiarTamanoTexto('extragrande')}
                  className={`cursor-pointer px-3 py-2 text-xs font-medium rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                    preferencias.tamanoTexto === 'extragrande'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-pressed={preferencias.tamanoTexto === 'extragrande'}
                >
                  <Type className="w-5 h-5" aria-hidden="true" />
                  <span>Extra</span>
                </button>
              </div>
            </div>

            {/* 2. Interruptores Rápidos de Visibilidad */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
                Visualización y Lectura
              </label>

              {/* Alto Contraste */}
              <button
                type="button"
                onClick={alternarAltoContraste}
                className={`cursor-pointer w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  preferencias.altoContraste
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={preferencias.altoContraste}
              >
                <div className="flex items-center gap-3">
                  <SunMedium className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span className="text-xs">Alto Contraste</span>
                </div>
                {preferencias.altoContraste && <Check className="w-4 h-4 text-blue-600" aria-hidden="true" />}
              </button>

              {/* Escala de Grises */}
              <button
                type="button"
                onClick={alternarEscalaGrises}
                className={`cursor-pointer w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  preferencias.escalaGrises
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={preferencias.escalaGrises}
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span className="text-xs">Escala de Grises</span>
                </div>
                {preferencias.escalaGrises && <Check className="w-4 h-4 text-blue-600" aria-hidden="true" />}
              </button>

              {/* Fuente Legible */}
              <button
                type="button"
                onClick={alternarFuenteLegible}
                className={`cursor-pointer w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  preferencias.fuenteLegible
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={preferencias.fuenteLegible}
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span className="text-xs">Espaciado y Fuente Legible</span>
                </div>
                {preferencias.fuenteLegible && <Check className="w-4 h-4 text-blue-600" aria-hidden="true" />}
              </button>

              {/* Subrayar Enlaces */}
              <button
                type="button"
                onClick={alternarSubrayarEnlaces}
                className={`cursor-pointer w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  preferencias.subrayarEnlaces
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={preferencias.subrayarEnlaces}
              >
                <div className="flex items-center gap-3">
                  <Underline className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span className="text-xs">Resaltar y Subrayar Enlaces</span>
                </div>
                {preferencias.subrayarEnlaces && <Check className="w-4 h-4 text-blue-600" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Pie del Panel con botón Restablecer */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {totalModificacionesActivas > 0
                ? `${totalModificacionesActivas} ${totalModificacionesActivas === 1 ? 'ajuste activo' : 'ajustes activos'}`
                : 'Sin cambios aplicados'}
            </span>
            <button
              type="button"
              onClick={restablecerTodo}
              disabled={totalModificacionesActivas === 0}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restablecer</span>
            </button>
          </div>
        </section>
      )}

      {/* Botón Flotante Activador */}
      <button
        ref={botonActivadorRef}
        type="button"
        onClick={() => setPanelAbierto((prev) => !prev)}
        className="cursor-pointer relative p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl active:scale-95 transition-all duration-200 focus-visible:ring-4 focus-visible:ring-blue-300 focus-visible:outline-hidden"
        aria-label="Menú de accesibilidad"
        aria-expanded={panelAbierto}
        aria-haspopup="dialog"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
        {totalModificacionesActivas > 0 && (
          <span 
            className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white shadow-sm"
            aria-label={`${totalModificacionesActivas} ajustes de accesibilidad activos`}
          >
            {totalModificacionesActivas}
          </span>
        )}
      </button>
    </aside>
  );
};
