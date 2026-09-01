import { createFileRoute, redirect } from '@tanstack/react-router'
import { InvitarContenedor } from '../../../views/Usuarios/Invitar/InvitarContenedor'

export const Route = createFileRoute('/_protegidas/usuarios/invitar')({
  beforeLoad: () => {
    const rol = localStorage.getItem('rol')
    if (rol !== 'AdministradorSistema') {
      throw redirect({ to: '/' })
    }
  },
  component: InvitarContenedor
})
