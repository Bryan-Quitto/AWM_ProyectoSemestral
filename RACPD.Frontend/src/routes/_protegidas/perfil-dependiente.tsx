import { createFileRoute } from '@tanstack/react-router';
import { PerfilDependienteDesktop } from '../../views/PerfilDependiente/PerfilDependienteDesktop';
import { PerfilDependienteMobile } from '../../views/PerfilDependiente/PerfilDependienteMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Route = createFileRoute('/_protegidas/perfil-dependiente')({
  component: function PerfilDependienteRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    return isMobile ? <PerfilDependienteMobile /> : <PerfilDependienteDesktop />;
  },
});
