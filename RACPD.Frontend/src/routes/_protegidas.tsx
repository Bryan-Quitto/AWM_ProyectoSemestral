import { createFileRoute, redirect } from '@tanstack/react-router'
import { LayoutPrincipal } from '../views/LayoutPrincipal/LayoutPrincipal'

export const Route = createFileRoute('/_protegidas')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated()) {
      throw redirect({
        to: '/inicio-sesion',
      })
    }
  },
  component: LayoutPrincipal
})
