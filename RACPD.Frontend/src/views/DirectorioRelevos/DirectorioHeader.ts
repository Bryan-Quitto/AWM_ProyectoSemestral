/**
 * Tipo compartido entre el Contenedor y las vistas Desktop/Mobile del
 * Directorio de Relevos. Encapsula los datos y handlers que se pasan
 * desde el componente agnóstico (Contenedor) a las vistas de plataforma.
 *
 * Persona 2 / Semana 2 — extension para soportar creación y edición de
 * relevos.
 */
import type { RelevoItemResponse } from '../../features/directorio-relevos/hooks/useDirectorioRelevos';

export interface DirectorioHeader {
  relevos: RelevoItemResponse[];
  isLoading: boolean;
  /** Handler para abrir el modal de creación. Si es undefined, el botón no se renderiza. */
  onAgregar?: () => void;
  /** Tooltip del botón cuando no se puede crear relevo. */
  tooltipBloqueado?: string;
  /** Habilita el botón Editar en cada tarjeta. Solo CuidadorPrincipal. */
  puedeEditar?: boolean;
  /** Handler para abrir el modal de edición con un relevo seleccionado. */
  onEditar?: (relevo: RelevoItemResponse) => void;
  /** Habilita el botón Eliminar en cada tarjeta. Solo CuidadorPrincipal. */
  puedeEliminar?: boolean;
  /**
   * Handler para iniciar el flujo de eliminación de un relevo.
   * Debe abrir un diálogo de confirmación antes de invocar al backend.
   */
  onEliminar?: (relevo: RelevoItemResponse) => void;
  /** Lista de dependientes visibles para el usuario (filtro del header). */
  perfilesDependientes?: Array<{ id: string; nombreCompleto: string }>;
  /** Dependiente actualmente seleccionado en el filtro (undefined = todos). */
  filtroDependienteId?: string;
  /** Handler para cambiar el filtro por dependiente. */
  onCambiarFiltroDependiente?: (perfilId: string | undefined) => void;
}
