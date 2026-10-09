import React from 'react';
import { 
  Type, 
  SunMedium, 
  Palette, 
  BookOpen, 
  Underline, 
  RotateCcw, 
  Check, 
  Eye, 
  EyeOff,
  Accessibility
} from 'lucide-react';
import { usePreferenciasAccesibilidad } from './usePreferenciasAccesibilidad';

export const SeccionConfiguracionAccesibilidad: React.FC = () => {
  const {
    preferencias,
    totalModificacionesActivas,
    cambiarTamanoTexto,
    alternarAltoContraste,
    alternarEscalaGrises,
    alternarFuenteLegible,
    alternarSubrayarEnlaces,
    alternarBotonFlotanteVisible,
    restablecerTodo,
  } = usePreferenciasAccesibilidad();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Accessibility className="w-5 h-5 text-blue-700" aria-hidden="true" />
          <h2 className="font-semibold text-blue-800">Accesibilidad y Lectura</h2>
        </div>
        {totalModificacionesActivas > 0 && (
          <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
            {totalModificacionesActivas} {totalModificacionesActivas === 1 ? 'activo' : 'activos'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Interruptor del Botón Flotante */}
        <div 
          onClick={alternarBotonFlotanteVisible}
          className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between gap-3 cursor-pointer select-none active:bg-blue-100/60 transition-colors"
        >
          <div className="space-y-0.5 pointer-events-none">
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              {preferencias.botonFlotanteVisible ? (
                <Eye className="w-4 h-4 text-blue-600" aria-hidden="true" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-500" aria-hidden="true" />
              )}
              Botón flotante en pantalla
            </span>
            <p className="text-xs text-gray-500 leading-snug">
              {preferencias.botonFlotanteVisible
                ? 'Visible en la esquina inferior. Puedes ocultarlo si prefieres mayor espacio.'
                : 'Oculto. Puedes seguir configurando la accesibilidad desde esta sección.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferencias.botonFlotanteVisible}
            onClick={(e) => {
              e.stopPropagation();
              alternarBotonFlotanteVisible();
            }}
            className={`cursor-pointer relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 p-0.5 ${
              preferencias.botonFlotanteVisible ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              style={{
                transform: preferencias.botonFlotanteVisible ? 'translateX(22px)' : 'translateX(2px)',
                transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="inline-block h-5 w-5 rounded-full bg-white shadow-sm pointer-events-none"
            />
          </button>
        </div>

        {/* 1. Tamaño del Texto */}
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
              <span>Grande (+15%)</span>
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
              <span>Extra (+30%)</span>
            </button>
          </div>
        </div>

        {/* 2. Opciones de Visualización */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
            Visualización y Legibilidad
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

        {/* Botón Restablecer */}
        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={restablecerTodo}
            disabled={totalModificacionesActivas === 0 && preferencias.botonFlotanteVisible}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Restablecer Opciones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
