import { ChevronDown, User } from 'lucide-react';
import { useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint } from '../../api/generated/api/api';
import {
  CLAVE_STORAGE_DEPENDIENTE_ACTIVO,
  useDependienteActivo,
} from './useDependienteActivo';

type DependienteResumen = {
  perfilId?: string;
  nombreCompleto?: string;
  rolEnDependiente?: string;
};

interface SelectorDependienteActivoProps {
  /**
   * Si la lista tiene 1 solo dependiente o si el rol no aplica
   * (ej. Administrador del Sistema), el selector no debe renderizar.
   * El padre decide la visibilidad.
   */
  visible: boolean;
  className?: string;
}

/**
 * Selector compacto del dependiente activo en el contexto del cuidador.
 * Se muestra solo cuando:
 *   - El usuario es CuidadorPrincipal o Apoyo (no Administrador del Sistema).
 *   - Tiene más de un dependiente vinculado.
 *
 * El id seleccionado se persiste en `localStorage` bajo la clave
 * `racpd.dependienteActivoId` (exportada desde `useDependienteActivo.ts`)
 * para mantener el contexto entre navegaciones y pestañas (criterio UX:
 * la campana y la agenda deben seguir mostrando al mismo dependiente
 * aunque el cuidador cambie de ruta).
 */
export const SelectorDependienteActivo = ({
  visible,
  className = '',
}: SelectorDependienteActivoProps) => {
  const { data, isLoading } =
    useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint();
  const lista = (data?.data ?? []) as DependienteResumen[];

  const { dependienteId, dependienteNombre } = useDependienteActivo();

  if (!visible || lista.length <= 1) return null;

  const handleCambio = (nuevoId: string) => {
    try {
      window.localStorage.setItem(CLAVE_STORAGE_DEPENDIENTE_ACTIVO, nuevoId);
    } catch {
      // Almacenamiento no disponible (modo privado, cuota, etc.):
      // el cambio no se persiste entre recargas, pero el siguiente SWR
      // fetch + re-render del hook verá la lista y mantendrá al usuario
      // en el primer dependiente hasta que el almacenamiento vuelva.
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <User className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
      <label htmlFor="selector-dependiente-activo" className="sr-only">
        Dependiente activo
      </label>
      <select
        id="selector-dependiente-activo"
        value={dependienteId ?? ''}
        onChange={(e) => handleCambio(e.target.value)}
        disabled={isLoading}
        aria-label={`Cambiar dependiente activo (actual: ${dependienteNombre || 'ninguno'})`}
        className="appearance-none bg-white border border-blue-200 rounded-lg pl-3 pr-7 py-1.5 text-sm font-medium text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 max-w-[180px]"
      >
        {lista.map((d) => (
          <option key={d.perfilId ?? d.nombreCompleto} value={d.perfilId ?? ''}>
            {d.nombreCompleto ?? 'Sin nombre'}
            {d.rolEnDependiente === 'CuidadorPrincipal' ? ' · Principal' : ''}
          </option>
        ))}
      </select>
      <ChevronDown
        className="w-4 h-4 text-blue-500 -ml-6 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
};