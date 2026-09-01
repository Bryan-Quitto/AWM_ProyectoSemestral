/**
 * Type Guard y utilidades para extraer el rol del usuario desde el JWT
 * de Supabase.
 *
 * IMPORTANTE:
 * - El JWT de Supabase expone el rol dentro de `app_metadata.role`
 *   como STRING (ej: "AdministradorSistema", "CuidadorPrincipal", "Apoyo").
 * - Esto difiere del enum generado por Orval para el Backend
 *   (`RACPDBackendDomainEnumsRol`), que se serializa como entero en
 *   los DTOs (0/1/2). El mismatch es deliberado: aquí siempre leemos
 *   del JWT, cuyo `app_metadata` es siempre string. Esta capa intermedia
 *   traduce el string del token a un set tipado que la UI puede
 *   comparar de forma segura (cumple REGLA-TS-ESTRICTO de SKILLS.md).
 */

export const ROLES_VALIDOS = [
  'AdministradorSistema',
  'CuidadorPrincipal',
  'Apoyo'
] as const

export type Rol = (typeof ROLES_VALIDOS)[number]

/**
 * Segmento decodificado del payload de un JWT (solo lectura).
 */
type PayloadJWT = {
  app_metadata?: { role?: unknown }
  user_metadata?: { role?: unknown }
}

/**
 * Decodifica un JWT y devuelve su payload.
 * Acepta la variante base64url con o sin padding.
 */
export const decodificarPayloadJWT = (token: string): PayloadJWT | null => {
  try {
    const segmento = token.split('.')[1]
    if (typeof segmento !== 'string' || segmento.length === 0) return null
    const normalizado = segmento.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalizado.length % 4 === 0 ? '' : '='.repeat(4 - (normalizado.length % 4))
    const json = atob(normalizado + padding)
    return JSON.parse(json) as PayloadJWT
  } catch {
    return null
  }
}

/**
 * Type Guard reutilizable: ¿el string es un Rol válido?
 * Cumple la regla "Uso obligatorio de Type Guards reutilizables" de SKILLS.md.
 */
export const esRolValido = (valor: unknown): valor is Rol => {
  return typeof valor === 'string' && (ROLES_VALIDOS as readonly string[]).includes(valor)
}

/**
 * Extrae el rol desde un token JWT de Supabase.
 * Devuelve `null` si el token está corrupto o si el rol no es válido.
 */
export const extraerRolDelToken = (token: string | undefined | null): Rol | null => {
  if (typeof token !== 'string' || token.length === 0) return null
  const payload = decodificarPayloadJWT(token)
  if (payload === null) return null
  const candidato =
    payload.app_metadata?.role ?? payload.user_metadata?.role
  return esRolValido(candidato) ? candidato : null
}

/**
 * Devuelve true si el rol recibido tiene permisos de administración.
 */
export const esAdministrador = (rol: Rol | string | null | undefined): boolean => {
  return rol === 'AdministradorSistema'
}
