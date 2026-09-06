import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { PaginaNoEncontrada } from '../components/PaginaNoEncontrada'

export interface RouterContext {
  isAuthenticated: () => boolean
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // Captura cualquier ruta inexistente (404). Se muestra la pantalla
  // dedicada independientemente de si la URL intentada era pública o
  // estaba bajo el prefijo /_protegidas.
  notFoundComponent: PaginaNoEncontrada,
  component: () => (
    <>
      {/*
        Toaster global para retroalimentación inmediata (ej. accesos
        denegados por RBAC). Tema claro coherente con la paleta de
        salud azul/celeste/blanco del proyecto.
      */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'border border-blue-200 shadow-lg rounded-xl text-sm',
            title: 'text-blue-900 font-semibold',
            description: 'text-blue-700',
            error: 'bg-red-50 text-red-900 border-red-200',
            success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
          }
        }}
      />
      <Outlet />
    </>
  )
})