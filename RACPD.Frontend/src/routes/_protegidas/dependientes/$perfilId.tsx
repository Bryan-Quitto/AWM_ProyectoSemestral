import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { PerfilDependienteDesktop } from '../../../views/PerfilDependiente/PerfilDependienteDesktop';
import { PerfilDependienteMobile } from '../../../views/PerfilDependiente/PerfilDependienteMobile';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { protegerRutaPorRol } from '../../../autenticacion/politicas';
import { useRACPDBackendFeaturesPerfilesDependientesObtenerDependienteObtenerDependienteEndpoint } from '../../../api/generated/api/api';
import { ChevronLeft } from 'lucide-react';

const perfilIdSearchSchema = z.object({
  // Solo aceptamos el literal '1' para evitar basura en la URL.
  // Si llega 'true'/'0'/cualquier otra cosa, lo rechazamos.
  editar: z.enum(['1']).optional(),
});

export const Route = createFileRoute('/_protegidas/dependientes/$perfilId')({
  validateSearch: (search) => perfilIdSearchSchema.parse(search),
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: function DependienteDetalleRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const navigate = useNavigate();
    const { perfilId } = Route.useParams();
    const { editar } = Route.useSearch();

    // SWR para conocer el rolEnDependiente y si puedeEditar
    const { data } =
      useRACPDBackendFeaturesPerfilesDependientesObtenerDependienteObtenerDependienteEndpoint(
        perfilId,
        { swr: { enabled: Boolean(perfilId) } }
      );

    const perfil = data?.data;
    const puedeEditar = perfil?.puedeEditar === true;
    // El componente arrancará en modo edición solo si:
    //   - el usuario pidió editar (?editar=1)
    //   - el backend autoriza (puedeEditar)
    const arrancarEnEdicion = editar === '1' && puedeEditar;

    const irALista = () => navigate({ to: '/dependientes' });

    return (
      <div>
        {/* Breadcrumb / volver */}
        <div className={isMobile ? 'px-4 pt-3' : 'max-w-6xl mx-auto px-8 pt-6'}>
          <button
            type="button"
            onClick={irALista}
            className="cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 transition text-sm font-medium disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Volver al listado
          </button>
        </div>

        {isMobile ? (
          <PerfilDependienteMobile
            perfilId={perfilId}
            onVolverALista={irALista}
            modoInicialEditar={arrancarEnEdicion}
          />
        ) : (
          <PerfilDependienteDesktop
            perfilId={perfilId}
            onVolverALista={irALista}
            modoInicialEditar={arrancarEnEdicion}
          />
        )}
      </div>
    );
  },
});
