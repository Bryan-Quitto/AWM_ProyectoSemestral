import { MessageCircle, Phone } from 'lucide-react';
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
}

/**
 * TarjetaCuidador
 *
 * UI ligada al dominio del Directorio de Relevos (se queda en /views,
 * no en /components, por la REGLA-AHA-UI de SKILLS.md).
 *
 * Muestra: avatar de iniciales, nombre, teléfono (E.164), badge de estado
 * y dos acciones de contacto: WhatsApp (deep-link wa.me) y Llamar (tel:).
 *
 * Cumple REGLA-UX-INTERACCIONES: cursor-pointer en todos los botones.
 */
export const TarjetaCuidador = ({ relevo }: Props) => {
  const nombre = relevo.nombre ?? '';
  const telefono = relevo.telefono ?? '';
  const estado: string = relevo.estado ?? 'NoDisponible';
  const esDisponible = estado === 'Disponible';

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

      <div className="flex gap-2">
        <a
          href={enlaceWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Contactar por WhatsApp a ${nombre}`}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
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
      </div>
    </div>
  );
};
