import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SOSMobile } from '../../views/PerfilDependiente/SOSMobile';
import { protegerRutaPorRol } from '../../autenticacion/politicas';

const sosSearchSchema = z.object({
  dependienteId: z.string().uuid().optional(),
});

export const Route = createFileRoute('/_protegidas/sos')({
  validateSearch: (search) => sosSearchSchema.parse(search),
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: function SosRoute() {
    const { dependienteId } = Route.useSearch();
    return <SOSMobile dependienteId={dependienteId} />;
  },
});
