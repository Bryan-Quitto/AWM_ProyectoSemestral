import { createFileRoute } from '@tanstack/react-router'
import { InvitarContenedor } from '../../../views/Usuarios/Invitar/InvitarContenedor'
import { protegerRutaPorRol } from '../../../autenticacion/politicas'

/**
 * Ruta exclusiva para AdministradorSistema.
 *
 * Usa el guard reutilizable `protegerRutaPorRol` para mantener una sola
 * fuente de verdad de políticas RBAC. Antes esta ruta tenía su propio
 * `beforeLoad` ad-hoc con redirect silencioso, lo cual dejaba al usuario
 * sin retroalimentación cuando intentaba entrar sin permisos.
 */
export const Route = createFileRoute('/_protegidas/usuarios/invitar')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname)
  },
  component: InvitarContenedor
})