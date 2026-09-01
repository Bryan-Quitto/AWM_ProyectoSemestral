import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { mutate } from 'swr'
import { supabase } from '../../lib/supabase'

/**
 * Hook que centraliza el flujo de cerrar sesión en RACPD.
 *
 * Pasos (en orden):
 * 1. Llama a `supabase.auth.signOut()` para invalidar la sesión del cliente
 *    Supabase (esto borra tokens en localStorage del SDK y notifica al backend).
 * 2. Limpia las claves legacy que pudiera haber dejado el flujo de login
 *    anterior basado en `localStorage`.
 * 3. Invalida la caché SWR de `mi-perfil` para que el siguiente usuario
 *    que inicie sesión no vea datos del anterior.
 * 4. Navega a /inicio-sesion.
 */
export const useCerrarSesion = () => {
  const navigate = useNavigate()
  const [cerrando, setCerrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cerrarSesion = useCallback(async () => {
    setCerrando(true)
    setError(null)
    try {
      const { error: errorSupabase } = await supabase.auth.signOut()
      if (errorSupabase) {
        setError(errorSupabase.message)
        return
      }

      // Limpieza defensiva de claves legacy del flujo anterior.
      localStorage.removeItem('token')
      localStorage.removeItem('rol')

      // Invalidar caché SWR del perfil para el próximo inicio de sesión.
      await mutate('/api/usuarios/mi-perfil', undefined, { revalidate: false })

      navigate({ to: '/inicio-sesion' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión.')
    } finally {
      setCerrando(false)
    }
  }, [navigate])

  return { cerrarSesion, cerrando, error }
}
