import { createFileRoute } from '@tanstack/react-router';
import { SOSMobile } from '../../views/PerfilDependiente/SOSMobile';
import { protegerRutaPorRol } from '../../autenticacion/politicas';

export const Route = createFileRoute('/_protegidas/sos')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: () => <SOSMobile />,
});
