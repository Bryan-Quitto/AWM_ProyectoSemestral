import { useMediaQuery } from '../../hooks/useMediaQuery';
import { AgendaDesktop } from './AgendaDesktop';
import { AgendaMobile } from './AgendaMobile';

interface AgendaContenedorProps {
  /**
   * ID del bloque que el Dashboard quiere destacar al cargar la Agenda.
   * Si llega, la vista salta al mes del bloque, lo enfoca y aplica el
   * anillo pulsante durante 3s. Después se limpia el search param.
   */
  bloqueIdDestacado?: string;
}

export const AgendaContenedor = ({ bloqueIdDestacado }: AgendaContenedorProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? (
    <AgendaMobile bloqueIdDestacado={bloqueIdDestacado} />
  ) : (
    <AgendaDesktop bloqueIdDestacado={bloqueIdDestacado} />
  );
};
