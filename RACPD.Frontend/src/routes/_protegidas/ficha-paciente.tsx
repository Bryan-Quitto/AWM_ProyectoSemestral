import { createFileRoute, redirect } from '@tanstack/react-router'

// Ruta legada 'ficha-paciente' redirige al listado de dependientes.
export const Route = createFileRoute('/_protegidas/ficha-paciente')({
  beforeLoad: () => {
    throw redirect({
      to: '/dependientes',
    })
  },
})
