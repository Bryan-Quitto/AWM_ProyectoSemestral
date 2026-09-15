import { createFileRoute } from '@tanstack/react-router';
import { DirectorioRelevosContenedor } from '../../views/DirectorioRelevos/DirectorioRelevosContenedor';
import { protegerRutaPorRol } from '../../autenticacion/politicas';

/**
 * Ruta /directorio-relevos
 *
 * Solo accesible para CuidadorPrincipal y Apoyo (el AdministradorSistema
 * no tiene acciones funcionales en el directorio). La política RBAC está
 * centralizada en `politicas.ts`.
 */
export const Route = createFileRoute('/_protegidas/directorio-relevos')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: () => (
    <div className="h-full">
      <DirectorioRelevosContenedor />
    </div>
  ),
});
