import { useMediaQuery } from '../../hooks/useMediaQuery';
import { AgendaDesktop } from './AgendaDesktop';
import { AgendaMobile } from './AgendaMobile';

export const AgendaContenedor = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <AgendaMobile /> : <AgendaDesktop />;
};
