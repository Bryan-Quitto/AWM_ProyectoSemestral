import { createFileRoute, Outlet } from '@tanstack/react-router';
import { protegerRutaPorRol } from '../../autenticacion/politicas';

/**
 * Layout padre de '/dependientes'. Renderiza un <Outlet/> para que las
 * rutas hijas ('/dependientes' índice y '/dependientes/$perfilId') se
 * inyecten correctamente. Sin esto, navegar a una ruta hija no muestra
 * el componente hijo porque TanStack Router no encuentra dónde montarlo.
 *
 * La lista en sí vive en '/_protegidas/dependientes/index.tsx' para que
 * esta ruta funcione como layout agnóstico.
 */
export const Route = createFileRoute('/_protegidas/dependientes')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: () => <Outlet />
});
