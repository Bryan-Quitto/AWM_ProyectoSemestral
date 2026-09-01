import { createFileRoute, redirect } from '@tanstack/react-router'
import { CompletarPerfilConGuardInverso } from '../../views/Usuarios/CompletarPerfil/CompletarPerfilConGuardInverso'
import { supabase } from '../../lib/supabase'

export const Route = createFileRoute('/_protegidas/completar-perfil')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/inicio-sesion' })
    }
    // El guard inverso (perfilCompleto === true → redirigir a /) se hace
    // en CompletarPerfilConGuardInverso vía SWR + useEffect, NO aquí, para
    // evitar bucles con el VerificadorPerfil del LayoutPrincipal.
  },
  component: CompletarPerfilConGuardInverso
})
