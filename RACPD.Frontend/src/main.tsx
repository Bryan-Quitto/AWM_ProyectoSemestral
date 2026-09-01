import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'

// `isAuthenticated` se consulta de forma síncrona para evitar redirects
// adicionales durante la inicialización del router. La verificación real y
// autoritativa de la sesión la hace el `beforeLoad` de la ruta protegida
// (usando Supabase). Aquí devolvemos `true` para no provocar redirecciones
// espurias hacia /inicio-sesion antes de que el cliente Supabase termine de
// inicializarse; si la sesión no existe, `_protegidas.tsx` lo detectará.
const router = createRouter({
  routeTree,
  context: {
    isAuthenticated: () => true
  }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
