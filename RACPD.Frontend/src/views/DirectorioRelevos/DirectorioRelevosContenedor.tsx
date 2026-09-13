import { useMediaQuery } from '../../hooks/useMediaQuery';
import { DirectorioRelevosDesktop } from './DirectorioRelevosDesktop';
import { DirectorioRelevosMobile } from './DirectorioRelevosMobile';

/**
 * Contenedor de la pantalla de Directorio de Relevos.
 * Bifurca entre Mobile y Desktop según el viewport (regla Dual Views).
 */
export const DirectorioRelevosContenedor = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <DirectorioRelevosMobile /> : <DirectorioRelevosDesktop />;
};
