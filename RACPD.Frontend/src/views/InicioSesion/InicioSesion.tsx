import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { iniciarSesionSchema } from './schema'
import { InicioSesionDesktop } from './InicioSesionDesktop'
import { InicioSesionMobile } from './InicioSesionMobile'
import { supabase } from '../../lib/supabase'
import { MENSAJE_CUENTA_DESACTIVADA } from '../../autenticacion/useVerificarCuentaActiva'

const URL_BASE_API: string =
  (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:5000'

const CLAVE_MENSAJE_FLASH = 'racpd:mensaje-flash'

// Inicialización lazy: si hay un mensaje flash pendiente (puesto por
// useVerificarCuentaActiva tras detectar cuenta desactivada), lo leemos
// una sola vez al montar y lo borramos para no re-mostrarlo en próximos
// montajes del componente.
const leerMensajeFlashInicial = (): string | null => {
  try {
    const mensaje = sessionStorage.getItem(CLAVE_MENSAJE_FLASH)
    if (mensaje !== null) {
      sessionStorage.removeItem(CLAVE_MENSAJE_FLASH)
      return mensaje
    }
  } catch {
    // sessionStorage no disponible: ignorar silenciosamente.
  }
  return null
}

export const InicioSesion = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [apiError, setApiError] = useState<string | null>(() =>
    leerMensajeFlashInicial()
  )
  const navigate = useNavigate()

  const form = useForm<z.infer<typeof iniciarSesionSchema>>({
    resolver: zodResolver(iniciarSesionSchema),
    defaultValues: {
      correo: '',
      contrasena: ''
    }
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [isMutating, setIsMutating] = useState(false)

  const onSubmit = async (data: z.infer<typeof iniciarSesionSchema>) => {
    setApiError(null)
    setIsMutating(true)
    try {
      // Autenticamos directamente contra Supabase desde el cliente. Esto
      // establece la sesión en el SDK (localStorage + cookies), que es la
      // fuente de verdad que consultan los guards del router.
      const { error } = await supabase.auth.signInWithPassword({
        email: data.correo,
        password: data.contrasena
      })

      if (error) {
        if (error.message.toLowerCase().includes('invalid')) {
          setApiError('Credenciales inválidas.')
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setApiError('Debes confirmar tu correo electrónico antes de iniciar sesión.')
        } else {
          setApiError(error.message)
        }
        return
      }

      // Pre-check de cuenta desactivada. Defensa cliente: aunque Supabase
      // Auth acepte las credenciales, la fila local puede tener
      // EstadoUsuario.Desactivado. En ese caso, limpiamos la sesión del
      // SDK y bloqueamos el ingreso.
      const resultadoSesion = await supabase.auth.getSession()
      const sesion = resultadoSesion.data.session
      if (sesion?.access_token) {
        try {
          const r = await fetch(`${URL_BASE_API}/api/usuarios/mi-perfil`, {
            headers: { Authorization: `Bearer ${sesion.access_token}` }
          })
          if (r.ok) {
            const perfil = (await r.json()) as { estado?: string }
            if (perfil?.estado === 'Desactivado') {
              await supabase.auth.signOut()
              setApiError(MENSAJE_CUENTA_DESACTIVADA)
              return
            }
          }
        } catch {
          // Si el backend no responde, no bloqueamos el ingreso: el guard
          // del router y VerificadorPerfil harán su trabajo.
        }
      }

      navigate({ to: '/' })
    } catch {
      setApiError('No se pudo conectar al servidor.')
    } finally {
      setIsMutating(false)
    }
  }

  const props = { form, onSubmit, isMutating, apiError }

  return isMobile ? <InicioSesionMobile {...props} /> : <InicioSesionDesktop {...props} />
}
