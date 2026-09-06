import { createFileRoute } from '@tanstack/react-router';
import { PerfilDependienteDesktop } from '../../views/PerfilDependiente/PerfilDependienteDesktop';
import { PerfilDependienteMobile } from '../../views/PerfilDependiente/PerfilDependienteMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { protegerRutaPorRol } from '../../autenticacion/politicas';

export const Route = createFileRoute('/_protegidas/perfil-dependiente')({
  // Guard RBAC: solo CuidadorPrincipal o Apoyo pueden acceder.
  // Si el rol del JWT no cumple, se dispara un toast y redirige a /.
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: function PerfilDependienteRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    return isMobile ? <PerfilDependienteMobile /> : <PerfilDependienteDesktop />;
  },
});