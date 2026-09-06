import { X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Boton } from '../../../components/Boton'
import { SelectorDinamico } from '../../../components/SelectorDinamico'
import { cambiarRolSchema, type CambiarRolFormValues, ETIQUETAS_ROL } from './schema'
import { RACPDBackendDomainEnumsRol } from '../../../api/generated/model'
import type { RACPDBackendFeaturesUsuariosAdministracionUsuarioAdministracionResponse } from '../../../api/generated/model'

interface ModalCambiarRolProps {
  abierto: boolean
  usuario: RACPDBackendFeaturesUsuariosAdministracionUsuarioAdministracionResponse
  onCerrar: () => void
  onConfirmar: (nuevoRolNumero: number) => Promise<void>
  isMutating: boolean
}

const OPCIONES_ROL = [
  { valor: RACPDBackendDomainEnumsRol.AdministradorSistema, etiqueta: ETIQUETAS_ROL[0] },
  { valor: RACPDBackendDomainEnumsRol.CuidadorPrincipal, etiqueta: ETIQUETAS_ROL[1] },
  { valor: RACPDBackendDomainEnumsRol.Apoyo, etiqueta: ETIQUETAS_ROL[2] }
]

/**
 * Modal de confirmación para cambio de rol.
 * Reutiliza `SelectorDinamico` (UI agnóstica en /components/) y
 * `Boton`. La validación de Zod es estricta (REGLA-ZOD-SCHEMA-BRIDGE).
 */
export const ModalCambiarRol = ({
  abierto,
  usuario,
  onCerrar,
  onConfirmar,
  isMutating
}: ModalCambiarRolProps) => {
  // Valor inicial: mapa string backend → número enum.
  const rolInicialNumero = (() => {
    switch (usuario.rol) {
      case 'AdministradorSistema':
        return RACPDBackendDomainEnumsRol.AdministradorSistema
      case 'CuidadorPrincipal':
        return RACPDBackendDomainEnumsRol.CuidadorPrincipal
      case 'Apoyo':
        return RACPDBackendDomainEnumsRol.Apoyo
      default:
        return RACPDBackendDomainEnumsRol.CuidadorPrincipal
    }
  })()

  const form = useForm<CambiarRolFormValues>({
    resolver: zodResolver(cambiarRolSchema),
    defaultValues: { rol: rolInicialNumero }
  })

  if (!abierto) return null

  const handleSubmit = form.handleSubmit(async (values) => {
    await onConfirmar(values.rol)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCerrar}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={onCerrar}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
          type="button"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <h3 className="text-lg font-semibold text-gray-900 mb-1">Cambiar rol</h3>
        <p className="text-sm text-gray-600 mb-5">
          Cambia el rol de <strong>{usuario.correo}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="rol"
              className="block text-sm font-medium text-blue-900 mb-1"
            >
              Nuevo rol
            </label>
            <Controller
              name="rol"
              control={form.control}
              render={({ field }) => (
                <SelectorDinamico
                  id="rol"
                  opciones={OPCIONES_ROL}
                  value={field.value}
                  onChange={field.onChange}
                  error={form.formState.errors.rol?.message}
                  disabled={isMutating}
                />
              )}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Boton
              type="button"
              variante="secundario"
              onClick={onCerrar}
              className="flex-1 cursor-pointer"
              disabled={isMutating}
            >
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={isMutating}
              className="flex-1 cursor-pointer"
            >
              {isMutating ? 'Guardando...' : 'Guardar cambio'}
            </Boton>
          </div>
        </form>
      </div>
    </div>
  )
}
