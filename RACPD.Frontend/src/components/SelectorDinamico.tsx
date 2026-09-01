import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface OpcionSelector {
  valor: string | number
  etiqueta: string
}

export interface SelectorDinamicoProps {
  id?: string
  opciones: OpcionSelector[]
  value?: string | number
  onChange?: (valor: string | number) => void
  error?: string
  disabled?: boolean
  className?: string
  placeholder?: string
}

export const SelectorDinamico = ({
  id,
  opciones,
  value,
  onChange,
  error,
  disabled,
  className = '',
  placeholder = 'Selecciona una opción...',
}: SelectorDinamicoProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const opcionSeleccionada = opciones.find((op) => op.valor === value)

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const handleSelect = (valor: string | number) => {
    if (onChange) onChange(valor)
    setIsOpen(false)
  }

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full p-3 pr-10 bg-white border rounded-xl transition-all
          text-left flex items-center justify-between
          focus:outline-none focus:ring-2 focus:border-transparent
          disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed
          ${
            error
              ? 'border-red-300 focus:ring-red-500 text-red-900'
              : 'border-blue-200 focus:ring-blue-500 text-gray-800'
          }
        `}
      >
        <span className="block truncate">
          {opcionSeleccionada ? opcionSeleccionada.etiqueta : placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-blue-500">
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-blue-100 py-1 max-h-60 overflow-auto">
          <ul className="focus:outline-none">
            {opciones.map((opcion) => {
              const isSelected = opcion.valor === value
              return (
                <li
                  key={opcion.valor}
                  onClick={() => handleSelect(opcion.valor)}
                  className={`
                    cursor-pointer select-none relative py-3 pl-10 pr-4 transition-colors
                    ${isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'text-gray-700 hover:bg-blue-50/50 hover:text-blue-900'}
                  `}
                >
                  <span className="block truncate">{opcion.etiqueta}</span>
                  {isSelected && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                      <Check className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

SelectorDinamico.displayName = 'SelectorDinamico'
