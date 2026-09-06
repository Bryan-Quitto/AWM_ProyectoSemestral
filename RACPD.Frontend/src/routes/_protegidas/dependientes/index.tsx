import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DependientesListaDesktop } from '../../../views/Dependientes/DependientesListaDesktop';
import { DependientesListaMobile } from '../../../views/Dependientes/DependientesListaMobile';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { extraerRolDelToken } from '../../../autenticacion/roles';
import { supabase } from '../../../lib/supabase';

export const Route = createFileRoute('/_protegidas/dependientes/')({
  component: function DependientesListaRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [rolGlobal, setRolGlobal] = useState<string | null>(null);

    useEffect(() => {
      const leer = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setRolGlobal(null);
          return;
        }
        setRolGlobal(extraerRolDelToken(session.access_token));
      };
      void leer();
    }, []);

    const puedeCrear = rolGlobal === 'CuidadorPrincipal';

    return isMobile ? (
      <DependientesListaMobile puedeCrear={puedeCrear} />
    ) : (
      <DependientesListaDesktop puedeCrear={puedeCrear} />
    );
  },
});
