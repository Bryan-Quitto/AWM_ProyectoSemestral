import { createFileRoute, redirect } from '@tanstack/react-router'
import { InvitarContenedor } from '../../../views/Usuarios/Invitar/InvitarContenedor'
import { supabase } from '../../../lib/supabase'
import { extraerRolDelToken, esAdministrador } from '../../../autenticacion/roles'

export const Route = createFileRoute('/_protegidas/usuarios/invitar')({
  beforeLoad: async () => {
    // ANTES (bug): leía el rol desde `localStorage.getItem('rol')`,
    // que NUNCA se escribe en este frontend. Resultado:
    // `rol !== 'AdministradorSistema'` siempre era verdadero y el
    // guard redirigía a '/' ANTES de que la petición llegara al
    // servidor (que sí autorizaba al Administrador real con 200 OK).
    //
    // AHORA: la única fuente de verdad del rol es el JWT de Supabase.
    // Se decodifica `app_metadata.role` y se valida contra la lista
    // tipada de roles permitidos (cumple REGLA-TS-ESTRICTO y Type Guards).

    const { data: { session } } = await supabase.auth.getSession()
    const rolDetectado = extraerRolDelToken(session?.access_token)

    // LOG TÁCTICO — Guard específico de Invitar.
    // Muestra lo que el router vio ANTES de decidir redirigir.
    // eslint-disable-next-line no-console
    console.info('[RBAC] /usuarios/invitar | intento:', {
      ubicacion: '/_protegidas/usuarios/invitar',
      estadoSesion: session ? 'ACTIVA' : 'AUSENTE',
      rolDetectado: rolDetectado ?? 'NO_DETECTADO'
    })

    if (!session || rolDetectado === null) {
      // Sin sesión o rol corrupto: mandar a login.
      throw redirect({ to: '/inicio-sesion' })
    }

    if (!esAdministrador(rolDetectado)) {
      // Sesión válida pero rol insuficiente: NO es un ataque,
      // es un cuidador que intentó llegar a una zona admin.
      // Redirigimos al inicio protegido (no a login).
      throw redirect({ to: '/' })
    }

    // Si llegamos aquí, el usuario es AdministradorSistema.
    // Dejamos pasar al componente, que ya hará la invitación vía SWR.
  },
  component: InvitarContenedor
})
