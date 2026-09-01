import { createFileRoute, redirect } from '@tanstack/react-router'
import { InicioSesion } from '../views/InicioSesion/InicioSesion'

export const Route = createFileRoute('/inicio-sesion')({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated()) {
      throw redirect({
        to: '/',
      })
    }
  },
  component: InicioSesion
})
