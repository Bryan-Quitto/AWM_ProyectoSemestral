import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { PaginaNoEncontrada } from '../components/PaginaNoEncontrada'
import { PaginaError } from '../components/PaginaError'
import { BotonAccesibilidadFlotante } from '../components/Accesibilidad/BotonAccesibilidadFlotante'

export interface RouterContext {
  isAuthenticated: () => boolean
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // Captura cualquier ruta inexistente (404). Se muestra la pantalla
  // dedicada independientemente de si la URL intentada era pública o
  // estaba bajo el prefijo /_protegidas.
  notFoundComponent: PaginaNoEncontrada,
  // Captura errores no controlados en cualquier ruta (excepciones en
  // componentes, errores de render, etc.) y los muestra en una pantalla
  // dedicada, reemplazando el ErrorBoundary por defecto de TanStack
  // Router que exponía detalles técnicos al cuidador.
  errorComponent: PaginaError,
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
      <BotonAccesibilidadFlotante />
    </>
  )
})