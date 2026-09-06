/**
 * Hook que verifica periódicamente que la cuenta del usuario siga activa.
 *
 * Decisión arquitectónica (SPEC-003 / extensión):
 * Validar la cuenta en cada interacción sería overkill (mataría la
 * cache de SWR y añadiría latencia visible). En su lugar, validamos en
 * los 4 eventos naturales del navegador donde el costo es ~0:
 *
 *   1. `pageshow` (F5 / back-forward / restauración desde cache)
 *   2. `focus` de window (vuelve del SO)
 *   3. `visibilitychange` (pestaña vuelve a ser visible)
 *   4. Timer cada 5 minutos SOLO cuando la pestaña está oculta (timer
 *      en background no bloquea la UI; al volver a la pestaña el
 *      evento `visibilitychange` también disparará la verificación).
 *
 * Throttle explícito de 30 s para impedir ráfagas cuando varios
 * eventos disparan en sucesión (ej. F5 → focus → visibilitychange).
 *
 * Si detecta `EstadoUsuario.Desactivado`, hace `supabase.auth.signOut()`,
 * navega a `/inicio-sesion` y muestra el mensaje. Esta es la ÚNICA fuente
 * de verdad para esa cadena de acciones fuera del flujo de login.
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000'

/** Mensaje único, reutilizado por InicioSesion.tsx y este hook. */
export const MENSAJE_CUENTA_DESACTIVADA =
  'Tu cuenta ha sido desactivada. Por favor, contacta al ' +
  'administrador del sistema para reactivarla.'

const INTERVALO_BACKGROUND_MS = 5 * 60 * 1000 // 5 minutos
const THROTTLE_MS = 30 * 1000 // 30 segundos

interface PerfilRemoto {
  estado?: string
}

/**
 * Hook sin retorno. Se monta una sola vez en un componente de lifecycle
 * (idealmente `LayoutPrincipal`) y queda activo mientras la pestaña esté
 * abierta y el usuario autenticado.
 */
export const useVerificarCuentaActiva = (): void => {
  const navigate = useNavigate()
  const ultimoCheckRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const yaDesactivoRef = useRef<boolean>(false)

  useEffect(() => {
    const verificar = async (): Promise<void> => {
      // Throttle: si acabamos de verificar hace menos de THROTTLE_MS, salir.
      const ahora = Date.now()
      if (ahora - ultimoCheckRef.current < THROTTLE_MS) return
      ultimoCheckRef.current = ahora

      // Si ya detectamos desactivación y disparamos signOut, no repetir.
      if (yaDesactivoRef.current) return

      try {
        const { data } = await supabase.auth.getSession()
        const sesion = data.session
        if (!sesion?.access_token) {
          // Sin sesión no hay nada que verificar; el guard del router
          // se encarga de redirigir a /inicio-sesion.
          return
        }

        const r = await fetch(`${URL_BASE_API}/api/usuarios/mi-perfil`, {
          headers: { Authorization: `Bearer ${sesion.access_token}` }
        })

        if (!r.ok) return

        const perfil = (await r.json()) as PerfilRemoto
        if (perfil?.estado !== 'Desactivado') return

        // Cuenta desactivada: signOut + redirect.
        // El mensaje se mostrará al usuario porque:
        //  1. supabase.auth.signOut() borra tokens, pero NO limpia el state
        //     local del componente InicioSesion.
        //  2. InicioSesion lee su propio mensaje si llega con un "flash"
        //     (ver búsqueda de mensaje flash abajo). Por simplicidad,
        //     usamos sessionStorage como puente one-shot.
        yaDesactivoRef.current = true
        try {
          sessionStorage.setItem('racpd:mensaje-flash', MENSAJE_CUENTA_DESACTIVADA)
        } catch {
          // sessionStorage puede no estar disponible (modo privado, SSR);
          // en ese caso el usuario simplemente verá la pantalla de login
          // limpia y podrá intentar de nuevo.
        }
        await supabase.auth.signOut()
        navigate({ to: '/inicio-sesion' })
      } catch {
        // Fallos de red son esperados (offline, etc.); no hacemos nada.
      }
    }

    const onPageShow = (): void => {
      void verificar()
    }
    const onFocus = (): void => {
      void verificar()
    }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void verificar()
      }
    }

    // Verificación inicial al montar (cubre F5 / primera carga bajo
    // la ruta protegida). El VerificadorPerfil ya hace un fetch al
    // primer mount, pero este hook cubre también el caso en que se
    // monte directamente sin pasar por VerificadorPerfil.
    void verificar()

    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Timer en background: solo se registra, se inicia cuando la pestaña
    // se oculta y se detiene cuando vuelve a ser visible para no hacer
    // checks redundantes con el evento visibilitychange.
    const arrancarTimer = (): void => {
      if (intervalRef.current !== null) return
      intervalRef.current = setInterval(() => {
        void verificar()
      }, INTERVALO_BACKGROUND_MS)
    }
    const detenerTimer = (): void => {
      if (intervalRef.current === null) return
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const onVisibilityChangeTimer = (): void => {
      if (document.visibilityState === 'hidden') {
        arrancarTimer()
      } else {
        detenerTimer()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChangeTimer)

    return () => {
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('visibilitychange', onVisibilityChangeTimer)
      detenerTimer()
    }
  }, [navigate])
}
