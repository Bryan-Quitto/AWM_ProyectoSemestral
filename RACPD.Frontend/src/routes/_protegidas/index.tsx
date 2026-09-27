import { createFileRoute } from '@tanstack/react-router'
import { DashboardContenedor } from '../../views/Dashboard/DashboardContenedor'

export const Route = createFileRoute('/_protegidas/')({
  component: () => (
    <div className="h-full">
      <DashboardContenedor />
    </div>
  )
})
