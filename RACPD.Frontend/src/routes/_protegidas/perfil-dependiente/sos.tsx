import { createFileRoute } from '@tanstack/react-router';
import { SOSMobile } from '../../../views/PerfilDependiente/SOSMobile';
import { protegerRutaPorRol } from '../../../autenticacion/politicas';

export const Route = createFileRoute('/_protegidas/perfil-dependiente/sos')({
  // Hereda RBAC del padre '/perfil-dependiente': solo CuidadorPrincipal
  // o Apoyo pueden abrir el modo SOS. Si falla → toast + redirect.
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: function SOSRoute() {
    return <SOSMobile />;
  },
});