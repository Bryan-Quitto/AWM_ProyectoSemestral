/**
 * Componente `IndicadorFortalezaContrasena`.
 *
 * Muestra visualmente el cumplimiento de la política de contraseña
 * establecida en RACPD. Se compone de una barra segmentada con tres
 * secciones y una lista de requisitos con su estado individual.
 *
 * Reglas visuales:
 * - 'vacia'  → barra totalmente inactiva (gris).
 * - 'debil'  → primer segmento activo en rojo.
 * - 'media'  → dos segmentos activos en amarillo.
 * - 'fuerte' → tres segmentos activos en verde.
 */
import { Check, X } from 'lucide-react';
import {
  usePoliticaContrasena,
  type NivelFortaleza,
} from './usePoliticaContrasena';

/**
 * Propiedades del componente `IndicadorFortalezaContrasena`.
 */
type IndicadorFortalezaContrasenaProps = {
  contrasena: string;
};

/**
 * Mapa que traduce el nivel de fortaleza a la cantidad de segmentos
 * activos que deben pintarse. Se mantiene tipado de forma explícita.
 */
const segmentosActivosPorNivel: Record<NivelFortaleza, number> = {
  vacia: 0,
  debil: 1,
  media: 2,
  fuerte: 3,
};

/**
 * Mapa que traduce el nivel de fortaleza al color Tailwind del segmento
 * activo. Mantener este mapa fuera del JSX evita lógica condicional
 * dentro del marcado.
 */
const colorActivoPorNivel: Record<NivelFortaleza, string> = {
  vacia: 'bg-gray-200',
  debil: 'bg-red-400',
  media: 'bg-yellow-400',
  fuerte: 'bg-green-500',
};

/**
 * Renderiza un requisito individual con su ícono (check verde o X roja)
 * y la etiqueta descriptiva en español.
 */
function RenderizarRequisito(props: { cumplido: boolean; etiqueta: string }) {
  const { cumplido, etiqueta } = props;
  const claseIcono = cumplido ? 'text-green-600' : 'text-red-500';
  const Icono = cumplido ? Check : X;

  return (
    <li className="flex items-center gap-2 text-sm">
      <Icono className={claseIcono} aria-hidden="true" size={16} />
      <span className="text-gray-700">{etiqueta}</span>
    </li>
  );
}

/**
 * Componente que muestra el indicador visual de fortaleza de contraseña.
 */
export function IndicadorFortalezaContrasena(
  props: IndicadorFortalezaContrasenaProps,
) {
  const { contrasena } = props;
  const { requisitos, nivel } = usePoliticaContrasena(contrasena);

  const segmentosActivos: number = segmentosActivosPorNivel[nivel];
  const colorActivo: string = colorActivoPorNivel[nivel];

  return (
    <div className="p-3 border border-blue-100 rounded-lg bg-white">
      <div className="flex gap-1" role="group" aria-label="Indicador de fortaleza de la contraseña">
        <span
          aria-hidden="true"
          className={`h-2 flex-1 rounded-full ${segmentosActivos >= 1 ? colorActivo : 'bg-gray-200'}`}
        />
        <span
          aria-hidden="true"
          className={`h-2 flex-1 rounded-full ${segmentosActivos >= 2 ? colorActivo : 'bg-gray-200'}`}
        />
        <span
          aria-hidden="true"
          className={`h-2 flex-1 rounded-full ${segmentosActivos >= 3 ? colorActivo : 'bg-gray-200'}`}
        />
      </div>

      <ul className="mt-3 space-y-1">
        <RenderizarRequisito
          cumplido={requisitos.longitud}
          etiqueta="Al menos 8 caracteres"
        />
        <RenderizarRequisito
          cumplido={requisitos.mayuscula}
          etiqueta="Una letra mayúscula"
        />
        <RenderizarRequisito
          cumplido={requisitos.minuscula}
          etiqueta="Una letra minúscula"
        />
        <RenderizarRequisito
          cumplido={requisitos.digito}
          etiqueta="Un dígito numérico"
        />
        <RenderizarRequisito
          cumplido={requisitos.especial}
          etiqueta="Un carácter especial"
        />
      </ul>
    </div>
  );
}