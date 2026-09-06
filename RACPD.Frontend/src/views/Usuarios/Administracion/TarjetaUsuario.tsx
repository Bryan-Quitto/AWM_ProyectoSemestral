import { useState } from 'react'
import { Mail, ShieldCheck, Power } from 'lucide-react'
import { Boton } from '../../../components/Boton'
import { ConfirmarAccion } from '../../Agenda/ConfirmarAccion'
// TODO DEUDA TÉCNICA: ModalCambiarRol y el cambio de rol están deshabilitados
// en la UI. Mantener el import comentado hasta que se defina el modelo de
// transición de roles (ver comentario en el botón "Cambiar rol" más abajo).
// import { ModalCambiarRol } from './ModalCambiarRol'
import { ETIQUETAS_ROL, ETIQUETAS_ESTADO } from './schema'
import type { RACPDBackendFeaturesUsuariosAdministracionUsuarioAdministracionResponse } from '../../../api/generated/model'

interface TarjetaUsuarioProps {
  usuario: RACPDBackendFeaturesUsuariosAdministracionUsuarioAdministracionResponse
  /**
   * ID del usuario autenticado actualmente. Se usa para impedir que
   * el admin se modifique/desactive a sí mismo (defensa UX).
   */
  esMiPropiaCuenta: boolean
  // TODO DEUDA TÉCNICA: prop onCambiarRol comentada. Reactivar junto con
  // el botón "Cambiar rol" cuando se defina el modelo de transición de roles.
  // onCambiarRol: (id: string, nuevoRolNumero: number) => Promise<void>
  onCambiarEstado: (id: string, nuevoEstado: 'Activo' | 'Desactivado') => Promise<void>
  isMutating: boolean
}

/**
 * Tarjeta con los datos de un usuario y sus acciones administrativas.
 * UI de dominio → vive en /views/.
 *
 * Cumple:
 * - cursor-pointer en todo lo interactivo (REGLA-UX-INTERACCIONES)
 * - disabled:cursor-not-allowed + opacity-50 en acciones bloqueadas
 * - Etiquetas en español (Spanish-Only)
 */
export const TarjetaUsuario = ({
  usuario,
  esMiPropiaCuenta,
  // onCambiarRol, // TODO DEUDA TÉCNICA: comentado hasta reactivar cambio de rol.
  onCambiarEstado,
  isMutating
}: TarjetaUsuarioProps) => {
  // TODO DEUDA TÉCNICA: estado del modal de cambio de rol deshabilitado.
  // const [modalRolAbierto, setModalRolAbierto] = useState(false)
  const [confirmarEstado, setConfirmarEstado] = useState<{
    abierto: boolean
    objetivo: 'Activo' | 'Desactivado'
  } | null>(null)

  const id = usuario.id ?? ''

  // Mapear el string del backend a la etiqueta legible.
  const etiquetaRolActual = (() => {
    switch (usuario.rol) {
      case 'AdministradorSistema':
        return ETIQUETAS_ROL[0]
      case 'CuidadorPrincipal':
        return ETIQUETAS_ROL[1]
      case 'Apoyo':
        return ETIQUETAS_ROL[2]
      default:
        return usuario.rol ?? '—'
    }
  })()

  const estadoActual = usuario.estado ?? ''
  const etiquetaEstado = ETIQUETAS_ESTADO[estadoActual] ?? estadoActual

  // Color del badge de estado.
  const claseBadgeEstado = (() => {
    switch (estadoActual) {
      case 'Activo':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Desactivado':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'PendienteAceptacion':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'PerfilIncompleto':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  })()

  // Estado derivado: solo se puede desactivar si NO es la propia cuenta
  // y NO es el último admin activo. El check del "último admin" lo hace
  // el backend; aquí solo reflejamos la primera condición.
  const puedeDesactivar = !esMiPropiaCuenta && estadoActual === 'Activo'
  const puedeActivar = estadoActual === 'Desactivado'

  const nombreCompleto = [usuario.nombre, usuario.apellido]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .join(' ')
    .trim()

  const etiquetaAccionEstado =
    confirmarEstado?.objetivo === 'Desactivado' ? 'Desactivar' : 'Activar'

  return (
    <>
      <article className="bg-white rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-base leading-tight truncate">
                {nombreCompleto.length > 0 ? nombreCompleto : 'Sin nombre registrado'}
                {esMiPropiaCuenta && (
                  <span className="ml-2 text-[10px] bg-white/30 px-2 py-0.5 rounded-full align-middle">
                    TÚ
                  </span>
                )}
              </h2>
              <p className="text-xs text-sky-50/90 mt-0.5 truncate flex items-center gap-1">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{usuario.correo ?? '—'}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full border bg-blue-50 text-blue-800 border-blue-200 font-medium">
              {etiquetaRolActual}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${claseBadgeEstado}`}>
              {etiquetaEstado}
            </span>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
            {/*
              TODO DEUDA TÉCNICA (deuda deliberada y prudente — decidir en próxima iteración):
              El botón "Cambiar rol" está DESHABILITADO en esta iteración y NO se
              renderiza en la UI. Por ahora solo se ofrece Activar/Desactivar.

              Motivo: cambiar el rol de un usuario tiene implicaciones profundas
              que requieren diseño cuidadoso en una plataforma de cuidadores.
              Ejemplos de problemas que hay que resolver ANTES de habilitarlo:
                1. Si un usuario Apoyo pasa a CuidadorPrincipal, automáticamente
                   adquiere permisos de edición sobre TODAS las fichas donde ya
                   tiene vínculo activo (incluso si nunca fue creado por él).
                   → ¿Se debería exigir re-firma de responsabilidad civil?
                2. Si un CuidadorPrincipal pasa a Apoyo, podría perder acceso a
                   sus propias fichas. ¿Qué pasa con los vínculos que creó?
                3. Si un Apoyo pasa a AdministradorSistema, podría ver datos
                   sensibles de toda la plataforma sin pasar por un proceso
                   formal de aceptación.
              Mientras no se defina el modelo de transición de roles (auditoría,
              aceptación explícita, ventana de gracia, reversión), esta acción
              queda deshabilitada en UI. El endpoint de backend
              PATCH /api/usuarios/{id}/rol SIGUE EXISTIENDO y compila; se
              ocultará/eliminarán juntos cuando se tome la decisión final.

              Cuando se reactive:
                1. Restaurar el <Boton> "Cambiar rol" (ver historial git).
                2. Restaurar el <ModalCambiarRol> al final del componente.
                3. Restaurar import de ModalCambiarRol y UserCog arriba.
                4. Restaurar estado modalRolAbierto con useState.
                5. Restaurar prop onCambiarRol en TarjetaUsuarioProps.
                6. Restaurar import del endpoint y handler handleCambiarRol
                   en UsuariosAdministracionContenedor.
                7. Restaurar prop onCambiarRol en Props de Desktop y Mobile.
                8. Eliminar el toast de "deshabilitado temporalmente" del handler.
            */}
            {puedeDesactivar && (
              <Boton
                type="button"
                onClick={() =>
                  setConfirmarEstado({ abierto: true, objetivo: 'Desactivado' })
                }
                cargando={isMutating}
                className="flex-1 py-2 rounded-xl text-sm !bg-red-600 hover:!bg-red-700"
              >
                <Power className="w-4 h-4 mr-1.5" /> Desactivar
              </Boton>
            )}
            {puedeActivar && (
              <Boton
                type="button"
                onClick={() =>
                  setConfirmarEstado({ abierto: true, objetivo: 'Activo' })
                }
                cargando={isMutating}
                className="flex-1 py-2 rounded-xl text-sm"
              >
                <Power className="w-4 h-4 mr-1.5" /> Activar
              </Boton>
            )}
          </div>
        </div>
      </article>

      {/* TODO DEUDA TÉCNICA: <ModalCambiarRol …/> eliminado temporalmente.
          Ver comentario detallado del botón "Cambiar rol" más arriba.
          Restaurar junto con su import + estado modalRolAbierto + prop
          onCambiarRol cuando se defina el modelo de transición de roles. */}

      <ConfirmarAccion
        abierto={confirmarEstado?.abierto === true}
        titulo={`${etiquetaAccionEstado} cuenta`}
        mensaje={
          confirmarEstado?.objetivo === 'Desactivado'
            ? `¿Estás seguro de desactivar la cuenta de "${nombreCompleto || usuario.correo}"? No podrá iniciar sesión hasta que sea reactivada.`
            : `¿Estás seguro de activar la cuenta de "${nombreCompleto || usuario.correo}"? Volverá a poder iniciar sesión.`
        }
        onConfirmar={async () => {
          if (confirmarEstado) {
            await onCambiarEstado(id, confirmarEstado.objetivo)
            setConfirmarEstado(null)
          }
        }}
        onCancelar={() => setConfirmarEstado(null)}
        cargando={isMutating}
        tipo={confirmarEstado?.objetivo === 'Desactivado' ? 'peligro' : 'info'}
      />
    </>
  )
}
