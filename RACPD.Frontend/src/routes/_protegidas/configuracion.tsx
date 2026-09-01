import { createFileRoute } from '@tanstack/react-router';
import { ConfiguracionDesktop } from '../../views/Configuracion/ConfiguracionDesktop';
import { ConfiguracionMobile } from '../../views/Configuracion/ConfiguracionMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Route = createFileRoute('/_protegidas/configuracion')({
  component: function ConfiguracionRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    return isMobile ? <ConfiguracionMobile /> : <ConfiguracionDesktop />;
  }
});
