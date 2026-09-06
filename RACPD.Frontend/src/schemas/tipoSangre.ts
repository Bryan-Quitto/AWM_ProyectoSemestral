import { TIPOS_SANGRE, type TipoSangre } from '../views/PerfilDependiente/schema';

/**
 * Etiquetas legibles para los tipos de sangre mostradas en UI.
 *
 * Mantener este mapa centralizado evita divergencias entre la lista de
 * dependientes (que mostraba `APositivo` en crudo) y el detalle (que
 * mostraba `A+`).
 *
 * Regla aplicada: si añades un valor a `TIPOS_SANGRE` en el schema,
 * TypeScript te exigirá una entrada aquí.
 */
export const TIPO_SANGRE_ETIQUETAS: Record<TipoSangre, string> = {
  APositivo: 'A+',
  ANegativo: 'A−',
  BPositivo: 'B+',
  BNegativo: 'B−',
  ABPositivo: 'AB+',
  ABNegativo: 'AB−',
  OPositivo: 'O+',
  ONegativo: 'O−',
  Desconocido: 'Desconocido',
};

/**
 * Devuelve la etiqueta legible de un tipo de sangre.
 * Si el valor recibido no pertenece a `TIPOS_SANGRE`, devuelve
 * `'Desconocido'` como fallback defensivo (Regla Zero-Indulgence).
 */
export function etiquetaTipoSangre(valor: string | null | undefined): string {
  if (typeof valor === 'string' && (TIPOS_SANGRE as readonly string[]).includes(valor)) {
    return TIPO_SANGRE_ETIQUETAS[valor as TipoSangre];
  }
  return TIPO_SANGRE_ETIQUETAS.Desconocido;
}

export { TIPOS_SANGRE };
export type { TipoSangre };
