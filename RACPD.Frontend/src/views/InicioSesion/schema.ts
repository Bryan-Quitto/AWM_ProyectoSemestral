import { z } from 'zod'

export const iniciarSesionSchema = z.object({
  correo: z.string().min(1, "El correo es requerido").email("El correo no tiene un formato válido"),
  contrasena: z.string().min(1, "La contraseña es requerida")
})
