import { useEffect } from 'react'
import useSWR from 'swr'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { CargadorPantallaCompleta } from '../_compartido/CargadorPantallaCompleta'

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000'

const KEY_MI_PERFIL = '/api/usuarios/mi-perfil'

type MiPerfilDTO = {
  id?: string
  correo?: string
  nombre?: string
  apellido?: string
  rol?: string
  estado?: string
}

const fetcherMiPerfil = async (): Promise<MiPerfilDTO | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const res = await fetch(`${URL_BASE_API}${KEY_MI_PERFIL}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  })

  // 401/403: el guard de la ruta (_protegidas) ya se encarga de expulsar
  // al usuario a /inicio-sesion. NO devolvemos null aquí porque eso
  // disparaba un fallo silencioso en versiones anteriores.
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Sesión rechazada por el backend (${res.status}).`)
  }

  // Otros errores (404, 5xx): por ahora fail-open con null para no
  // bloquear al cuidador frente a problemas del backend. (Este es un
  // punto a endurecer en otra iteración.)
  if (!res.ok) return null

  const perfil = (await res.json()) as MiPerfilDTO
  return perfil
}

/**
 * Componente que monta el LayoutPrincipal para garantizar que cualquier
 * usuario autenticado con perfilCompleto=false sea enviado a /completar-perfil.
 *
 * Decisiones de diseño (refactor 2026-09):
 * - Usa SWR con cache global para evitar un fetch por cada navegación.
 * - La redirección se hace con useEffect + useNavigate, NUNCA desde el
 *   `beforeLoad` de la ruta, para no crear bucles con el guard inverso
 *   de /completar-perfil.
 * - **Estado derivado respetado:** `perfil` solo se "ve" si el SWR no
 *   está cargando. No se renderizan las vistas hijas hasta tener la
 *   respuesta (¡bloqueo de render estricto!), evitando redirects
 *   prematuros basados en `undefined`.
 * - Si el backend no responde con error recuperable (4xx distintos a
 *   401/403, 5xx), NO redirige (fail-open explícito).
 * - Ignora la redirección si ya estamos en /completar-perfil.
 */
export const VerificadorPerfil = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: perfil, isLoading, error } = useSWR(KEY_MI_PERFIL, fetcherMiPerfil, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000
  })

  useEffect(() => {
    if (isLoading) return
    if (perfil === undefined || perfil === null) return
    if (location.pathname === '/completar-perfil') return

    if (perfil.estado === 'PendienteAceptacion' || perfil.estado === 'PerfilIncompleto') {
      navigate({ to: '/completar-perfil' })
    }
  }, [perfil, isLoading, navigate, location.pathname])

  // BLOQUEO ESTRICTO DE RENDERIZADO:
  // - Si SWR está cargando, mostramos un cargador a pantalla completa.
  // - Si hubo un error de autorización, forzamos redirect vía navigate.
  // - Solo dejamos pasar al Layout si tenemos la respuesta y sabemos
  //   que NO hay que redirigir (o el navigate ya se disparó).
  if (isLoading) {
    return <CargadorPantallaCompleta texto="Verificando tu perfil…" />
  }

  if (error instanceof Error && /401|403|Sesión rechazada/.test(error.message)) {
    // useEffect arriba se encargará de navegar si hace falta; mientras
    // tanto, mostramos el cargador para no parpadear.
    return <CargadorPantallaCompleta texto="Reverificando sesión…" />
  }

  return null
}
