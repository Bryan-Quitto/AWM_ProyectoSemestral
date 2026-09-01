import { createFileRoute, redirect } from '@tanstack/react-router'
import { InicioSesion } from '../views/InicioSesion/InicioSesion'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/inicio-sesion')({
  beforeLoad: async () => {
    // Verificamos la sesión real de Supabase, no localStorage. Esto evita
    // que un token obsoleto en localStorage provoque un bucle de redirects.
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: InicioSesion
})
