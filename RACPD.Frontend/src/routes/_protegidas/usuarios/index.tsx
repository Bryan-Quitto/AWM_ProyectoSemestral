import { createFileRoute } from '@tanstack/react-router'
import { UsuariosAdministracionContenedor } from '../../../views/Usuarios/Administracion/UsuariosAdministracionContenedor'
import { protegerRutaPorRol } from '../../../autenticacion/politicas'

/**
 * Ruta exclusiva para AdministradorSistema.
 *
 * Lista todos los usuarios del sistema (cualquier estado) y permite
 * cambiar el rol y activar/desactivar cuentas.
 *
 * Usa el guard reutilizable `protegerRutaPorRol` para mantener una sola
 * fuente de verdad de políticas RBAC.
 */
export const Route = createFileRoute('/_protegidas/usuarios/')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname)
  },
  component: UsuariosAdministracionContenedor
})
