import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { InvitarContenedor } from '../../../views/Usuarios/Invitar/InvitarContenedor'
import { protegerRutaPorRol } from '../../../autenticacion/politicas'
import { useMediaQuery } from '../../../hooks/useMediaQuery'

/**
 * Ruta exclusiva para AdministradorSistema.
 *
 * Usa el guard reutilizable `protegerRutaPorRol` para mantener una sola
 * fuente de verdad de políticas RBAC. Antes esta ruta tenía su propio
 * `beforeLoad` ad-hoc con redirect silencioso, lo cual dejaba al usuario
 * sin retroalimentación cuando intentaba entrar sin permisos.
 *
 * Botón "Volver al listado" replicado desde /dependientes/$perfilId.tsx
 * y /dependientes/nuevo.tsx para mantener consistencia visual entre las
 * rutas de detalle/creación de la plataforma.
 */
export const Route = createFileRoute('/_protegidas/usuarios/invitar')({
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname)
  },
  component: function UsuariosInvitarRoute() {
    const isMobile = useMediaQuery('(max-width: 768px)')
    const navigate = useNavigate()

    const irALista = () => navigate({ to: '/usuarios' })

    return (
      <div>
        <div className={isMobile ? 'px-4 pt-3' : 'max-w-6xl mx-auto px-8 pt-6'}>
          <button
            type="button"
            onClick={irALista}
            className="cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 transition text-sm font-medium disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Volver al listado
          </button>
        </div>
        <InvitarContenedor />
      </div>
    )
  }
})
