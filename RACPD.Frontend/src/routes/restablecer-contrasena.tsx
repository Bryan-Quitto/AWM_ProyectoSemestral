import { createFileRoute } from '@tanstack/react-router';
import { RestablecerContrasena } from '../views/RestablecerContrasena/RestablecerContrasena';

export const Route = createFileRoute('/restablecer-contrasena')({
  // Esta ruta DEJA PASAR la navegación siempre. La verificación de que
  // la URL trae indicios válidos de recuperación (`#access_token=...&type=recovery`
  // o `?code=...` PKCE) ocurre en el contenedor `RestablecerContrasena`,
  // NO en el guard. Esto evita pantalla congelada y race conditions con
  // el procesamiento del fragmento URL que Supabase hace al cargar el bundle.
  beforeLoad: async () => {
    // Sin redirecciones aquí: el contenedor gestiona los tres estados
    // ('esperando' → 'listo' | 'invalido').
  },
  component: RestablecerContrasena
});
