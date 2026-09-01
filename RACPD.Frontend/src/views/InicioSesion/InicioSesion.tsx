import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import { iniciarSesionSchema } from './schema'
import { InicioSesionDesktop } from './InicioSesionDesktop'
import { InicioSesionMobile } from './InicioSesionMobile'
import { useRACPDBackendFeaturesIdentidadInicioSesionInicioSesionEndpoint } from '../../api/generated/api/api'

export const InicioSesion = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [apiError, setApiError] = useState<string | null>(null)
  const navigate = useNavigate()
  
  const { trigger, isMutating } = useRACPDBackendFeaturesIdentidadInicioSesionInicioSesionEndpoint()

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

  const onSubmit = async (data: z.infer<typeof iniciarSesionSchema>) => {
    setApiError(null)
    try {
      const response = await trigger(data)
      if (response.status === 200) {
        localStorage.setItem('token', response.data.token!)
        navigate({ to: '/' })
      } else if (response.status === 400) {
        const errorData = response.data as any
        let detailedMessage = 'Credenciales inválidas.'
        
        if (errorData.errors && typeof errorData.errors === 'object') {
          const keys = Object.keys(errorData.errors)
          if (keys.length > 0) {
            detailedMessage = errorData.errors[keys[0]][0]
          }
        } else if (errorData.detail) {
          detailedMessage = errorData.detail
        } else if (errorData.message && errorData.message !== 'One or more validation errors occurred.') {
          detailedMessage = errorData.message
        }
        
        setApiError(detailedMessage)
      } else {
        setApiError('Ha ocurrido un error inesperado al iniciar sesión.')
      }
    } catch {
      setApiError('No se pudo conectar al servidor.')
    }
  }

  const props = { form, onSubmit, isMutating, apiError }

  return isMobile ? <InicioSesionMobile {...props} /> : <InicioSesionDesktop {...props} />
}
