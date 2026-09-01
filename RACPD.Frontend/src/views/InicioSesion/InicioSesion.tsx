import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { iniciarSesionSchema } from './schema'
import { InicioSesionDesktop } from './InicioSesionDesktop'
import { InicioSesionMobile } from './InicioSesionMobile'
import { supabase } from '../../lib/supabase'

export const InicioSesion = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [apiError, setApiError] = useState<string | null>(null)
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
