import { createFileRoute } from '@tanstack/react-router'
import { AgendaContenedor } from '../../views/Agenda/AgendaContenedor'
import { protegerRutaPorRol } from '../../autenticacion/politicas'

export const Route = createFileRoute('/_protegidas/agenda')({
  // Solo CuidadorPrincipal y Apoyo acceden a la agenda. El Administrador
  // del sistema no tiene acciones funcionales aquí, por lo que mantener
  // su acceso generaba "acceso vacío". Si fuerza la URL → toast + redirect.
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname)
  },
  component: () => (
    <div className="h-full">
      <AgendaContenedor />
    </div>
  )
})