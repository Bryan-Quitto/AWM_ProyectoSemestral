import { MessageCircle, Phone, Pencil, Trash2, User } from 'lucide-react';
import { construirEnlaceWhatsApp } from './construirEnlaceWhatsApp';
import type { RelevoItemResponse } from '../../features/directorio-relevos/hooks/useDirectorioRelevos';

const MENSAJE_WHATSAPP =
  'Hola, te contacto desde la plataforma RACPD para consultar tu disponibilidad...';

const obtenerIniciales = (nombre: string): string => {
  const partes = nombre.split(' ').filter(Boolean);
  const dosPrimeras = partes.slice(0, 2);
  const iniciales = dosPrimeras
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return iniciales || 'CU';
};

interface Props {
  relevo: RelevoItemResponse;
  /** Cuando es true, muestra el botón Editar. Solo para CuidadorPrincipal. */
  puedeEditar?: boolean;
  onEditar?: (relevo: RelevoItemResponse) => void;
  /** Cuando es true, muestra el botón Eliminar. Solo para CuidadorPrincipal. */
  puedeEliminar?: boolean;
  /**
   * Handler que abre el diálogo de confirmación. La eliminación real
   * la dispara el Contenedor tras la confirmación.
   */
  onEliminar?: (relevo: RelevoItemResponse) => void;
}

/**
 * TarjetaCuidador
 *
 * UI ligada al dominio del Directorio de Relevos (se queda en /views,
 * no en /components, por la REGLA-AHA-UI de SKILLS.md).
 *
 * Muestra: avatar de iniciales, nombre, teléfono (E.164), badge de estado
 * y acciones: WhatsApp (deep-link wa.me), Llamar (tel:) y, si el usuario
 * es CuidadorPrincipal, Editar y Eliminar.
 *
 * Cumple REGLA-UX-INTERACCIONES: cursor-pointer en todos los botones.
 */
export const TarjetaCuidador = ({
  relevo,
  puedeEditar,
  onEditar,
  puedeEliminar,
  onEliminar,
}: Props) => {
  const nombre = relevo.nombre ?? '';
  const telefono = relevo.telefono ?? '';
  const estado: string = relevo.estado ?? 'NoDisponible';
  const esDisponible = estado === 'Disponible';
  const dependienteNombre = relevo.dependienteNombre ?? '';

  const enlaceWhatsApp = construirEnlaceWhatsApp(telefono, MENSAJE_WHATSAPP);
  const telefonoLink = `tel:${telefono.replace(/\D/g, '')}`;

  return (
    <div className="bg-white rounded-2xl border border-blue-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {obtenerIniciales(nombre)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate" title={nombre}>
            {nombre}
          </h3>
          <p className="text-sm text-gray-600 truncate" title={telefono}>
            {telefono}
          </p>
          {dependienteNombre && (
            <p
              className="text-xs text-blue-700 mt-1 inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md"
              title={`Dependiente: ${dependienteNombre}`}
            >
              <User className="w-3 h-3" aria-hidden="true" />
              <span className="truncate max-w-[10rem]">{dependienteNombre}</span>
            </p>
          )}
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
            esDisponible
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {estado}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <a
          href={enlaceWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Contactar por WhatsApp a ${nombre}`}
          className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-2 py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
        <a
          href={telefonoLink}
          aria-label={`Llamar a ${nombre}`}
          className="inline-flex items-center justify-center gap-2 py-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
        >
          <Phone className="w-4 h-4" />
          Llamar
        </a>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => onEditar?.(relevo)}
            aria-label={`Editar relevo de ${nombre}`}
            className="inline-flex items-center justify-center gap-2 py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {puedeEliminar && (
          <button
            type="button"
            onClick={() => onEliminar?.(relevo)}
            aria-label={`Eliminar relevo de ${nombre}`}
            className="inline-flex items-center justify-center gap-2 py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
