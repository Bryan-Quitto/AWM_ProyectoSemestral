import { createFileRoute, redirect } from '@tanstack/react-router';
import { RecuperarContrasena } from '../views/RecuperarContrasena/RecuperarContrasena';
import { supabase } from '../lib/supabase';

export const Route = createFileRoute('/recuperar-contrasena')({
  beforeLoad: async () => {
    // Si ya hay sesión activa, redirigir al panel principal: no tiene
    // sentido solicitar un enlace de recuperación si el cuidador ya
    // está autenticado.
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      throw redirect({ to: '/' });
    }
  },
  component: RecuperarContrasena
});
