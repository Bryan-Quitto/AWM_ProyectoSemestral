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

const mapearErrorInvitacion = (data: unknown): string => {
  if (!data || typeof data !== 'object') {
    return 'Ha ocurrido un error al invitar al usuario.'
  }
  const obj = data as Record<string, unknown>

  // Caso especial 409: el backend devuelve { mensaje: "..." } con texto legible.
  if (typeof obj['mensaje'] === 'string' && obj['mensaje'].length > 0) {
    return obj['mensaje']
  }

  // Estructura típica de ProblemDetails de FastEndpoints con FluentValidation.
  if (obj['errors'] && typeof obj['errors'] === 'object') {
    const errorsObj = obj['errors'] as Record<string, unknown>
    const keys = Object.keys(errorsObj)
    if (keys.length > 0) {
      const primerValor = errorsObj[keys[0]]
      if (Array.isArray(primerValor) && primerValor.length > 0 && typeof primerValor[0] === 'string') {
        return primerValor[0]
      }
    }
  }

  if (typeof obj['detail'] === 'string' && obj['detail'].length > 0) {
    return obj['detail']
  }

  if (
    typeof obj['message'] === 'string' &&
    obj['message'] !== 'One or more validation errors occurred.'
  ) {
    return obj['message']
  }

  return 'Ha ocurrido un error al invitar al usuario.'
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
      rol: 1
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
      // Cast a `number` porque el backend también devuelve 409 pero Orval no
      // lo documenta en el contrato (es status union 200 | 400 | 401 | 403).
      const status = response.status as number
      if (status === 200) {
        setExito('¡Invitación enviada con éxito!')
        form.reset()
      } else {
        const errorData = (response as { data?: unknown }).data
        const detalle = mapearErrorInvitacion(errorData)
        setApiError(detalle)
      }
    } catch {
      setApiError('No se pudo conectar al servidor.')
    }
  }

  const props: InvitarProps = { form, onSubmit, isMutating, apiError, exito }

  return isMobile ? <InvitarMobile {...props} /> : <InvitarDesktop {...props} />
}
