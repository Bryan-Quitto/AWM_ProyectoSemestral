import { z } from 'zod'
import { RACPDBackendDomainEnumsRol } from '../../../api/generated/model'

export const invitarUsuarioSchema = z.object({
  correo: z.string().min(1, 'El correo es requerido.').email('El correo no tiene un formato válido.'),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres.'),
  rol: z.nativeEnum(RACPDBackendDomainEnumsRol, {
    message: 'Debes seleccionar un rol válido.'
  })
})
