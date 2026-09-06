import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { protegerRutaPorRol } from '../../../autenticacion/politicas';
import { useRACPDBackendFeaturesPerfilesDependientesObtenerDependienteObtenerDependienteEndpoint } from '../../../api/generated/api/api';
import { ChevronLeft } from 'lucide-react';
import { PersonasAccesoPanel } from '../../../views/Dependientes/PersonasAccesoPanel';

/**
 * Ruta dedicada a la sección "Personas con acceso" del perfil dependiente.
 * Solo accesible si el usuario actual es CuidadorPrincipal del perfil
 * (validado por el SWR que devuelve `puedeEditar` y reforzado por la política
 * de ruta en `protegerRutaPorRol`).
 */
export const Route = createFileRoute('/_protegidas/dependientes/$perfilId_/acceso')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: function DependienteAccesoRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const navigate = useNavigate();
    const { perfilId } = Route.useParams();

    // SWR para conocer el rolEnDependiente y si puedeEditar.
    const { data } =
      useRACPDBackendFeaturesPerfilesDependientesObtenerDependienteObtenerDependienteEndpoint(
        perfilId,
        { swr: { enabled: Boolean(perfilId) } }
      );

    const puedeEditar = data?.data?.puedeEditar === true;

    const irALista = () => navigate({ to: '/dependientes' });
    const irADetalle = () =>
      navigate({ to: '/dependientes/$perfilId', params: { perfilId } });

    return (
      <div>
        {/* Breadcrumb / volver */}
        <div className={isMobile ? 'px-4 pt-3' : 'max-w-6xl mx-auto px-8 pt-6'}>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={irALista}
              className="cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 transition text-sm font-medium disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Volver al listado
            </button>
            <button
              type="button"
              onClick={irADetalle}
              className="cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 transition text-sm font-medium disabled:opacity-50"
            >
              Volver a la ficha
            </button>
          </div>
        </div>

        <div className={isMobile ? 'px-4 pb-10' : 'max-w-6xl mx-auto px-8 pb-12'}>
          <h1
            className={
              isMobile
                ? 'text-xl font-bold text-blue-900 mb-4'
                : 'text-2xl font-bold text-blue-900 mb-6'
            }
          >
            Gestión de accesos
          </h1>
          {puedeEditar ? (
            <PersonasAccesoPanel
              perfilId={perfilId}
              variant={isMobile ? 'mobile' : 'desktop'}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-blue-100 p-6 text-sm text-gray-600">
              Solo el cuidador principal puede gestionar quién tiene acceso a este perfil.
            </div>
          )}
        </div>
      </div>
    );
  },
});