/**
 * Wrapper de `fetch` que inyecta automáticamente el Bearer token de Supabase
 * en cada request al backend. Se usa como `mutator` en orval.config.ts para
 * que todos los hooks SWR generados incluyan el header `Authorization`.
 *
 * Solo añade el header si la URL es absoluta hacia el backend (VITE_API_URL)
 * o si es una ruta relativa `/api/...`. Para otros orígenes (Supabase
 * directo, etc.) NO añade el header.
 */
import { supabase } from '../lib/supabase'

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000'

export const customFetch = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const headers = new Headers(options.headers)

  // Inyectar Authorization solo si la URL apunta al backend.
  const esLlamadaAlBackend =
    url.startsWith(URL_BASE_API) || url.startsWith('/api/')

  if (esLlamadaAlBackend && !headers.has('Authorization')) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  }

  const respuesta = await fetch(url, { ...options, headers })
  
  let data: any
  try {
    const text = await respuesta.text()
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }

  return {
    data,
    status: respuesta.status,
    headers: respuesta.headers
  } as unknown as T
}
