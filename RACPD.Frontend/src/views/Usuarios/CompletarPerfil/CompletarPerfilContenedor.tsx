import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { mutate } from 'swr'
import { completarPerfilSchema, type CompletarPerfilForm } from './schema'
import { CompletarPerfilDesktop } from './CompletarPerfilDesktop'
import { CompletarPerfilMobile } from './CompletarPerfilMobile'
import { supabase } from '../../../lib/supabase'
import {
  useRACPDBackendFeaturesUsuariosMiPerfilCompletarPerfilEndpoint,
  useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint
} from '../../../api/generated/api/api'
import type { RACPDBackendFeaturesUsuariosMiPerfilCompletarPerfilRequest } from '../../../api/generated/model'

export type CompletarPerfilProps = {
  form: UseFormReturn<CompletarPerfilForm>
  onSubmit: (data: CompletarPerfilForm) => Promise<void>
  isMutating: boolean
  apiError: string | null
  rolTextoLegible: string
  cargandoPerfil: boolean
}

const traducirErrorSupabase = (msg: string): string => {
  if (msg.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (msg.includes('too weak')) {
    return 'La contraseña es demasiado débil.'
  }
  if (msg.includes('same as')) {
    return 'La nueva contraseña no puede ser igual a la anterior.'
  }
  if (msg.includes('JWT') || msg.includes('expired')) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  }
  return msg
}

const mapearProblemDetails = (data: unknown): string => {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if ('errors' in obj && obj.errors && typeof obj.errors === 'object') {
      const errorsObj = obj.errors as Record<string, unknown>
      const keys = Object.keys(errorsObj)
      if (keys.length > 0) {
        const primerValor = errorsObj[keys[0]]
        if (Array.isArray(primerValor) && primerValor.length > 0 && typeof primerValor[0] === 'string') {
          return primerValor[0]
        }
      }
    }
    if ('detail' in obj && typeof obj.detail === 'string') {
      return obj.detail
    }
    if ('title' in obj && typeof obj.title === 'string') {
      return obj.title
    }
  }
  return 'Ha ocurrido un error inesperado.'
}

export const CompletarPerfilContenedor = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [apiError, setApiError] = useState<string | null>(null)

  const navigate = useNavigate()

  const { data: respuestaPerfil, isLoading: cargandoPerfil } =
    useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint()

  const { trigger: completarPerfil, isMutating: enviando } =
    useRACPDBackendFeaturesUsuariosMiPerfilCompletarPerfilEndpoint()

  // Orval envuelve la respuesta en { data, status, headers }. Para el caso
  // exitoso, el body del backend está en respuestaPerfil.data.
  const perfil =
    respuestaPerfil && 'data' in respuestaPerfil
      ? respuestaPerfil.data
      : undefined

  const form = useForm<CompletarPerfilForm>({
    resolver: zodResolver(completarPerfilSchema),
    defaultValues: {
      nombre: '',
      apellido: '',
      contrasena: '',
      confirmarContrasena: ''
    }
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const rolTextoLegible: string =
    perfil?.rol === 'CuidadorPrincipal'
      ? 'Cuidador Principal'
      : perfil?.rol === 'Apoyo'
        ? 'Apoyo'
        : perfil?.rol === 'AdministradorSistema'
          ? 'Administrador del Sistema'
          : ''

  const onSubmit = async (data: CompletarPerfilForm) => {
    setApiError(null)
    try {
      const { error: errorContrasena } = await supabase.auth.updateUser({
        password: data.contrasena
      })
      if (errorContrasena) {
        setApiError(traducirErrorSupabase(errorContrasena.message))
        return
      }

      const payload: RACPDBackendFeaturesUsuariosMiPerfilCompletarPerfilRequest = {
        nombre: data.nombre,
        apellido: data.apellido
      }
      const respuesta = await completarPerfil(payload)
      // respuesta tiene status union 200 | 400 | 401 | 403, pero el backend
      // también puede devolver 409 (perfil ya completado) y Orval no lo
      // documenta. Usamos un cast defensivo para tratar el caso.
      const status = respuesta.status as number
      if (status === 200) {
        await mutate('/api/usuarios/mi-perfil')
        navigate({ to: '/' })
      } else if (status === 409) {
        setApiError('Tu perfil ya fue completado. Serás redirigido al inicio.')
        setTimeout(() => navigate({ to: '/' }), 2000)
      } else {
        const errorData = (respuesta as { data?: unknown }).data
        setApiError(mapearProblemDetails(errorData))
      }
    } catch {
      setApiError('No se pudo conectar al servidor.')
    }
  }

  const props: CompletarPerfilProps = {
    form,
    onSubmit,
    isMutating: enviando,
    apiError,
    rolTextoLegible,
    cargandoPerfil
  }

  if (cargandoPerfil) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-blue-700">Cargando...</p>
      </div>
    )
  }

  return isMobile ? <CompletarPerfilMobile {...props} /> : <CompletarPerfilDesktop {...props} />
}
