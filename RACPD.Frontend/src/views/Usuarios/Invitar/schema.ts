import { z } from 'zod'
import { RACPDBackendDomainEnumsRol } from '../../../api/generated/model'

export const invitarUsuarioSchema = z.object({
  correo: z.string().min(1, 'El correo es requerido.').email('El correo no tiene un formato válido.'),
  rol: z.nativeEnum(RACPDBackendDomainEnumsRol, {
    message: 'Debes seleccionar un rol válido.'
  })
})
