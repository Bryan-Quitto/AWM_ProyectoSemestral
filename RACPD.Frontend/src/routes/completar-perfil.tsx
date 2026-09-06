import { createFileRoute, redirect } from '@tanstack/react-router'
import { CompletarPerfilConGuardInverso } from '../views/Usuarios/CompletarPerfil/CompletarPerfilConGuardInverso'
import { supabase } from '../lib/supabase'

/**
 * Ruta pública-con-sesión: exige que el usuario esté autenticado pero NO
 * monta el LayoutPrincipal (header + sidebar). Es la pantalla de registro
 * inicial, debe estar libre de ruido visual para que el cuidador termine
 * el alta sin distracciones en situaciones de estrés.
 */
export const Route = createFileRoute('/completar-perfil')({
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
