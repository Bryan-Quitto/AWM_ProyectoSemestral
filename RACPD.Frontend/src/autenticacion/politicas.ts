/**
 * Políticas de autorización por ruta (RBAC declarativo).
 *
 * Cada entrada define qué roles pueden acceder a una ruta protegida.
 * El guard genérico `protegerRutaPorRol` se invoca desde el `beforeLoad`
 * de cada ruta que requiera control de roles.
 *
 * IMPORTANTE: Mantener alineado con las políticas del Backend
 * (atributo `Roles(...)` de cada Endpoint de FastEndpoints).
 */
import { toast } from 'sonner'
import { redirect, type Redirect } from '@tanstack/react-router'
import { extraerRolDelToken, type Rol } from '../autenticacion/roles'
import { supabase } from '../lib/supabase'

export type PoliticaRuta = {
  /** Roles permitidos. Si el rol del JWT no está aquí, se rechaza. */
  rolesPermitidos: readonly Rol[]
  /** Mensaje que verá el usuario en el toast cuando sea rechazado. */
  mensajeAccesoDenegado: string
}

/**
 * Diccionario único de políticas. Cualquier nueva ruta con RBAC debe
 * agregarse aquí (Regla de 3: 1 sola fuente de verdad).
 */
export const POLITICAS_RUTAS = {
  '/dependientes': {
    rolesPermitidos: ['CuidadorPrincipal', 'Apoyo'] as const,
    mensajeAccesoDenegado:
      'Tu rol no tiene permisos para acceder al listado de dependientes.'
  },
  '/dependientes/nuevo': {
    // El control fino se hace dentro de la ruta (solo CuidadorPrincipal).
    rolesPermitidos: ['CuidadorPrincipal', 'Apoyo'] as const,
    mensajeAccesoDenegado:
      'Tu rol no tiene permisos para crear dependientes.'
  },
  '/usuarios/invitar': {
    rolesPermitidos: ['AdministradorSistema'] as const,
    mensajeAccesoDenegado:
      'Solo los administradores del sistema pueden invitar usuarios.'
  },
  '/agenda': {
    // El rol AdministradorSistema NO tiene acciones funcionales en la
    // agenda (no puede crear, editar ni eliminar bloques desde la UI),
    // por lo que mantenerlo como viewer genera "acceso vacío" y viola
    // el principio de menor privilegio. Coherente con el spec, que lo
    // define únicamente como "Listar todos".
    rolesPermitidos: ['CuidadorPrincipal', 'Apoyo'] as const,
    mensajeAccesoDenegado:
      'Tu rol no tiene permisos para acceder a la agenda de turnos.'
  }
} satisfies Record<string, PoliticaRuta>

/**
 * Resuelve la política aplicable al pathname. Devuelve `null` si la ruta
 * no tiene política explícita (es "pública" para usuarios autenticados).
 */
export const resolverPolitica = (pathname: string): PoliticaRuta | null => {
  // Coincidencia exacta primero; fallback por prefijo para sub-rutas.
  if (pathname in POLITICAS_RUTAS) {
    return POLITICAS_RUTAS[pathname as keyof typeof POLITICAS_RUTAS]
  }
  for (const [ruta, politica] of Object.entries(POLITICAS_RUTAS)) {
    if (pathname.startsWith(`${ruta}/`)) return politica
  }
  return null
}

/**
 * Guard reutilizable para `beforeLoad` de TanStack Router.
 * - Si no hay sesión: redirige a /inicio-sesion (defensa redundante,
 *   el padre /_protegidas ya lo hace).
 * - Si hay sesión pero el rol no cumple la política: dispara un toast
 *   con `mensajeAccesoDenegado` y redirige a /.
 *
 * REGLA-TS-ESTRICTO: tipado estricto, sin `any`, sin aserciones ciegas.
 */
export const protegerRutaPorRol = async (
  pathname: string
): Promise<void | Redirect> => {
  const politica = resolverPolitica(pathname)
  if (!politica) return

  // Import estático (no dinámico): supabase ya está en el bundle inicial
  // porque lo importan otros 6 archivos del proyecto. Un dynamic import
  // aquí disparaba el warning INEFFECTIVE_DYNAMIC_IMPORT de Vite.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw redirect({ to: '/inicio-sesion' })
  }

  const rol = extraerRolDelToken(session.access_token)
  if (rol === null || !politica.rolesPermitidos.includes(rol)) {
    toast.error('Acceso restringido', {
      description: politica.mensajeAccesoDenegado,
      duration: 5000
    })
    throw redirect({ to: '/' })
  }
}