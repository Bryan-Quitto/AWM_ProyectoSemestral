import { createFileRoute } from '@tanstack/react-router'
import { Proximamente } from '../../components/Proximamente'

export const Route = createFileRoute('/_protegidas/ficha-paciente')({
  component: () => (
    <div className="p-6 h-full">
      <h1 className="text-2xl font-bold text-blue-900 mb-6">Ficha de Paciente</h1>
      <Proximamente />
    </div>
  )
})
