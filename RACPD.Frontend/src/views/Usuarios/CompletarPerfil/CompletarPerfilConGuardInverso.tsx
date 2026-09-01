import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import useSWR from 'swr'
import { supabase } from '../../../lib/supabase'
import { CompletarPerfilContenedor } from './CompletarPerfilContenedor'

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000'

type MiPerfil = { estado?: string }

const fetcherMiPerfil = async (): Promise<MiPerfil | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const res = await fetch(`${URL_BASE_API}/api/usuarios/mi-perfil`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
  if (!res.ok) return null
  return (await res.json()) as MiPerfil
}

/**
 * Wrapper que añade el guard de redirección inversa sobre CompletarPerfilContenedor.
 * Si el perfil del usuario ya está completo, navega a /. Se ejecuta con SWR +
 * useEffect (no en `beforeLoad`) para evitar bucles de redirección con el
 * VerificadorPerfil del LayoutPrincipal.
 */
export const CompletarPerfilConGuardInverso = () => {
  const navigate = useNavigate()
  const { data: perfil, isLoading } = useSWR<MiPerfil | null>(
    '/api/usuarios/mi-perfil',
    fetcherMiPerfil,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false
    }
  )

  useEffect(() => {
    if (isLoading) return
    if (!perfil) return
    if (perfil.estado === 'Activo') {
      navigate({ to: '/' })
    }
  }, [perfil, isLoading, navigate])

  return <CompletarPerfilContenedor />
}
