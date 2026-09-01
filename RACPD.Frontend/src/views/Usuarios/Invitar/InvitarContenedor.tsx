import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { invitarUsuarioSchema } from './schema'
import { InvitarDesktop } from './InvitarDesktop'
import { InvitarMobile } from './InvitarMobile'
import { useRACPDBackendFeaturesUsuariosInvitarInvitarEndpoint } from '../../../api/generated/api/api'

export type InvitarProps = {
  form: UseFormReturn<z.infer<typeof invitarUsuarioSchema>>
  onSubmit: (data: z.infer<typeof invitarUsuarioSchema>) => Promise<void>
  isMutating: boolean
  apiError: string | null
  exito: string | null
}

export const InvitarContenedor = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [apiError, setApiError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  
  const { trigger, isMutating } = useRACPDBackendFeaturesUsuariosInvitarInvitarEndpoint()

  const form = useForm<z.infer<typeof invitarUsuarioSchema>>({
    resolver: zodResolver(invitarUsuarioSchema),
    defaultValues: {
      correo: '',
      nombre: '',
      apellido: '',
      rol: 1 // Default to CuidadorPrincipal
    }
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const onSubmit = async (data: z.infer<typeof invitarUsuarioSchema>) => {
    setApiError(null)
    setExito(null)
    try {
      const response = await trigger(data)
      if (response.status === 200) {
        setExito('¡Invitación enviada con éxito!')
        form.reset()
      } else {
        const errorData = response.data as any
        let detailedMessage = 'Ha ocurrido un error al invitar al usuario.'
        
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
      }
    } catch {
      setApiError('No se pudo conectar al servidor.')
    }
  }

  const props: InvitarProps = { form, onSubmit, isMutating, apiError, exito }

  return isMobile ? <InvitarMobile {...props} /> : <InvitarDesktop {...props} />
}
