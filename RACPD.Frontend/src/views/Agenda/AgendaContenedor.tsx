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
  /**
   * Fecha de la ocurrencia concreta (YYYY-MM-DD) para saltar de inmediato
   * al mes y día correspondiente, incluso si el turno cae en el siguiente mes.
   */
  fechaDestacada?: string;
}

export const AgendaContenedor = ({ bloqueIdDestacado, fechaDestacada }: AgendaContenedorProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? (
    <AgendaMobile
      bloqueIdDestacado={bloqueIdDestacado}
      fechaDestacada={fechaDestacada}
    />
  ) : (
    <AgendaDesktop
      bloqueIdDestacado={bloqueIdDestacado}
      fechaDestacada={fechaDestacada}
    />
  );
};
