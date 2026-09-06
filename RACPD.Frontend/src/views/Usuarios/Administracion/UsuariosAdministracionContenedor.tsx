import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import Fuse from 'fuse.js'
import { toast } from 'sonner'
import {
  useRACPDBackendFeaturesUsuariosAdministracionListarUsuariosListarUsuariosEndpoint,
  // TODO DEUDA TÉCNICA: el cambio de rol está deshabilitado en la UI hasta
  // definir el modelo de transición de roles. Mantener el import comentado
  // junto con handleCambiarRol y la prop onCambiarRol que pasa a las vistas.
  // rACPDBackendFeaturesUsuariosAdministracionCambiarRolCambiarRolEndpoint,
  rACPDBackendFeaturesUsuariosAdministracionCambiarEstadoCambiarEstadoEndpoint
} from '../../../api/generated/api/api'
import { useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint } from '../../../api/generated/api/api'
import { UsuariosAdministracionDesktop } from './UsuariosAdministracionDesktop'
import { UsuariosAdministracionMobile } from './UsuariosAdministracionMobile'
// TODO DEUDA TÉCNICA: tipo del request de cambio de rol comentado hasta
// reactivar la funcionalidad.
// import type { RACPDBackendFeaturesUsuariosAdministracionCambiarRolCambiarRolRequest } from '../../../api/generated/model'

const URL_INVITAR = '/usuarios/invitar'

/**
 * Mapper defensivo de errores RFC 7807 / FastEndpoints.
 * Devuelve un string legible para el usuario; nunca un objeto.
 */
const mapearError = (data: unknown): string => {
  if (!data || typeof data !== 'object') return 'Ha ocurrido un error inesperado.'
  const obj = data as Record<string, unknown>

  if (typeof obj['detail'] === 'string' && obj['detail'].length > 0) {
    return obj['detail']
  }
  if (obj['errors'] && typeof obj['errors'] === 'object') {
    const errorsObj = obj['errors'] as Record<string, unknown>
    const keys = Object.keys(errorsObj)
    if (keys.length > 0) {
      const primerValor = errorsObj[keys[0]]
      if (Array.isArray(primerValor) && primerValor.length > 0 && typeof primerValor[0] === 'string') {
        return primerValor[0]
      }
    }
  }
  if (typeof obj['mensaje'] === 'string' && obj['mensaje'].length > 0) {
    return obj['mensaje']
  }
  if (
    typeof obj['message'] === 'string' &&
    obj['message'] !== 'One or more validation errors occurred.'
  ) {
    return obj['message']
  }
  return 'Ha ocurrido un error inesperado.'
}

/**
 * Orquestador de la vista "Gestión de Usuarios" (Admin only).
 * - Carga la lista vía SWR (hook generado por Orval).
 * - Búsqueda derivada con fuse.js sobre la lista cacheada (Zero-Wait).
 * - Mutaciones usan las funciones raw generadas por Orval porque el
 *   endpoint recibe `id` en la ruta; instanciar un hook por tarjeta
 *   generaría N suscripciones SWR y acoplamiento innecesario.
 * - Bifurca a Desktop o Mobile según ancho de viewport.
 */
export const UsuariosAdministracionContenedor = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [busqueda, setBusqueda] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { data: miPerfil } = useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint()
  const idSesionActual = miPerfil?.data?.id

  const { data, isLoading, mutate } =
    useRACPDBackendFeaturesUsuariosAdministracionListarUsuariosListarUsuariosEndpoint()

  const usuarios = useMemo(
    () => (data?.data ?? []) as Array<{
      id?: string
      correo?: string
      nombre?: string
      apellido?: string
      rol?: string
      estado?: string
    }>,
    [data]
  )

  // Búsqueda derivada con fuse.js (Zero-Wait: no debounce visible).
  const usuariosFiltrados = useMemo(() => {
    if (busqueda.trim().length === 0) return usuarios
    const fuse = new Fuse(usuarios, {
      keys: ['nombre', 'apellido', 'correo'],
      threshold: 0.35,
      ignoreLocation: true
    })
    return fuse.search(busqueda.trim()).map((r) => r.item)
  }, [usuarios, busqueda])

  // TODO DEUDA TÉCNICA: handler de cambio de rol eliminado temporalmente.
  // Motivo: implicaciones profundas (Apoyo→CuidadorPrincipal gana edición de
  // fichas no propias; CuidadorPrincipal→Apoyo podría perder acceso a sus
  // propias fichas; Apoyo→Admin expone datos sensibles sin proceso formal).
  // Decidir modelo de transición (auditoría, aceptación explícita, reversión)
  // ANTES de reactivar. El endpoint PATCH /api/usuarios/{id}/rol sigue
  // existiendo en backend; cuando se decida, restaurarlo siguiendo los pasos
  // documentados en TarjetaUsuario.tsx (botón "Cambiar rol").

  const handleCambiarEstado = async (
    id: string,
    nuevoEstado: 'Activo' | 'Desactivado'
  ) => {
    setIsMutating(true)
    try {
      const response = (await rACPDBackendFeaturesUsuariosAdministracionCambiarEstadoCambiarEstadoEndpoint(
        id,
        { estado: nuevoEstado }
      )) as { status?: number; data?: unknown }

      const status = response.status ?? 0
      if (status >= 200 && status < 300) {
        toast.success(
          nuevoEstado === 'Desactivado'
            ? 'Cuenta desactivada. El usuario no podrá iniciar sesión.'
            : 'Cuenta activada.'
        )
        await mutate()
        return
      }
      toast.error(mapearError(response.data))
    } catch {
      toast.error('No se pudo conectar al servidor.')
    } finally {
      setIsMutating(false)
    }
  }

  const props = {
    usuarios: usuariosFiltrados,
    isLoading,
    busqueda,
    onBuscar: setBusqueda,
    totalUsuarios: usuarios.length,
    totalFiltrados: usuariosFiltrados.length,
    isMutating,
    idSesionActual,
    // TODO DEUDA TÉCNICA: onCambiarRol deshabilitado. Restaurar cuando se
    // reactive el cambio de rol.
    // onCambiarRol: handleCambiarRol,
    onCambiarEstado: handleCambiarEstado,
    onInvitar: () => navigate({ to: URL_INVITAR })
  }

  return isMobile ? <UsuariosAdministracionMobile {...props} /> : <UsuariosAdministracionDesktop {...props} />
}
