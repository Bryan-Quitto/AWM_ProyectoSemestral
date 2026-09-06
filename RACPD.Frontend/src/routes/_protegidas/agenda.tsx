import { createFileRoute } from '@tanstack/react-router'
import { AgendaContenedor } from '../../views/Agenda/AgendaContenedor'

export const Route = createFileRoute('/_protegidas/agenda')({
  component: () => (
    <div className="h-full">
      <AgendaContenedor />
    </div>
  )
})
