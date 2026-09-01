import { createFileRoute, redirect } from '@tanstack/react-router'
import { LayoutPrincipal } from '../views/LayoutPrincipal/LayoutPrincipal'
import { supabase } from '../lib/supabase'
import { extraerRolDelToken } from '../autenticacion/roles'

export const Route = createFileRoute('/_protegidas')({
  beforeLoad: async () => {
    // Consultamos la sesión real en cada navegación. El SDK de Supabase
    // devuelve la sesión desde memoria si ya está hidratada, por lo que
    // esta llamada es de bajo costo. Usar un singleton cacheado aquí era
    // el bug: se resolvía con el estado PRE-login y nunca se actualizaba,
    // causando el bucle infinito de redirects.
    const { data: { session } } = await supabase.auth.getSession()
    const rolDetectado = extraerRolDelToken(session?.access_token)

    // LOG TÁCTICO — Guard padre (toda ruta bajo /_protegidas).
    // eslint-disable-next-line no-console
    console.info('[RBAC] _protegidas | intento:', {
      ubicacion: '/_protegidas (padre)',
      estadoSesion: session ? 'ACTIVA' : 'AUSENTE',
      rolDetectado: rolDetectado ?? 'NO_DETECTADO'
    })

    if (!session) {
      throw redirect({ to: '/inicio-sesion' })
    }
  },
  component: LayoutPrincipal
})
