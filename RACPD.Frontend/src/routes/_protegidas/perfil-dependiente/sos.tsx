import { createFileRoute } from '@tanstack/react-router';
import { SOSMobile } from '../../../views/PerfilDependiente/SOSMobile';

export const Route = createFileRoute('/_protegidas/perfil-dependiente/sos')({
  component: function SOSRoute() {
    return <SOSMobile />;
  },
});
