import { z } from 'zod'
import { RACPDBackendDomainEnumsRol } from '../../../api/generated/model'

/**
 * Esquema Zod para el formulario de cambio de rol.
 * El frontend usa el enum numérico generado por Orval (RACPDBackendDomainEnumsRol),
 * que coincide 1:1 con el enum del backend.
 */
export const cambiarRolSchema = z.object({
  rol: z.nativeEnum(RACPDBackendDomainEnumsRol, {
    message: 'Debes seleccionar un rol válido.'
  })
})

export type CambiarRolFormValues = z.infer<typeof cambiarRolSchema>

/**
 * Esquema Zod para el formulario de cambio de estado.
 * Solo se permiten los valores administrables desde la UI; los estados
 * `PendienteAceptacion` y `PerfilIncompleto` se gestionan en otros
 * flujos (invitación, completar perfil).
 */
export const cambiarEstadoSchema = z.object({
  estado: z.enum(['Activo', 'Desactivado'], {
    message: 'Debes seleccionar un estado válido.'
  })
})

export type CambiarEstadoFormValues = z.infer<typeof cambiarEstadoSchema>

/**
 * Etiquetas legibles para mostrar los roles en la UI.
 * Mantiene la regla "Spanish-Only" del proyecto.
 */
export const ETIQUETAS_ROL: Record<number, string> = {
  [RACPDBackendDomainEnumsRol.AdministradorSistema]: 'Administrador del Sistema',
  [RACPDBackendDomainEnumsRol.CuidadorPrincipal]: 'Cuidador Principal',
  [RACPDBackendDomainEnumsRol.Apoyo]: 'Apoyo'
}

/**
 * Etiquetas legibles para los estados de cuenta.
 */
export const ETIQUETAS_ESTADO: Record<string, string> = {
  PendienteAceptacion: 'Pendiente de Aceptación',
  PerfilIncompleto: 'Perfil Incompleto',
  Activo: 'Activo',
  Desactivado: 'Desactivado'
}
