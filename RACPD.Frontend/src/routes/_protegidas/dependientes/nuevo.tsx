import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { PerfilDependienteDesktop } from '../../../views/PerfilDependiente/PerfilDependienteDesktop';
import { PerfilDependienteMobile } from '../../../views/PerfilDependiente/PerfilDependienteMobile';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { protegerRutaPorRol } from '../../../autenticacion/politicas';
import { extraerRolDelToken } from '../../../autenticacion/roles';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';

export const Route = createFileRoute('/_protegidas/dependientes/nuevo')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname);
  },
  component: function DependienteNuevoRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const navigate = useNavigate();
    const [autorizado, setAutorizado] = useState<boolean | null>(null);

    useEffect(() => {
      const verificar = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw redirect({ to: '/inicio-sesion' });
        }
        const rol = extraerRolDelToken(session.access_token);
        if (rol !== 'CuidadorPrincipal') {
          toast.error('Solo los cuidadores principales pueden crear dependientes.');
          throw redirect({ to: '/dependientes' });
        }
        setAutorizado(true);
      };
      void verificar();
    }, []);

    const irALista = () => navigate({ to: '/dependientes' });

    if (autorizado === null) {
      return (
        <div className="p-8 text-center text-gray-500 bg-blue-50 min-h-screen">
          Verificando permisos...
        </div>
      );
    }

    return (
      <div>
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
          <PerfilDependienteMobile onVolverALista={irALista} />
        ) : (
          <PerfilDependienteDesktop onVolverALista={irALista} />
        )}
      </div>
    );
  },
});
