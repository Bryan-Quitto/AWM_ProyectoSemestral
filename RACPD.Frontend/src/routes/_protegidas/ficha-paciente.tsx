import { createFileRoute, redirect } from '@tanstack/react-router'

// Ruta legada 'ficha-paciente' redirige a la vista funcional 'perfil-dependiente'.
// El sidebar / tab bar de LayoutPrincipal Desktop y Mobile siguen apuntando aquí
// por consistencia visual, pero el destino real es la Ficha del Dependiente del SCEN 002.
export const Route = createFileRoute('/_protegidas/ficha-paciente')({
  beforeLoad: () => {
    throw redirect({
      to: '/perfil-dependiente',
    })
  },
})
