import { useNavigate } from '@tanstack/react-router'
import { Compass, Home, ArrowLeft } from 'lucide-react'
import { Boton } from './Boton'

/**
 * Pantalla dedicada para rutas inexistentes (404).
 *
 * Componente 100% agnóstico (sin lógica de dominio), ubicado en
 * `src/components/` según REGLA-AHA-UI de SKILLS.md.
 *
 * Diseñada para mantener el tono de "salud y tranquilidad" del proyecto:
 * gradiente azul/celeste/blanco, sin rojos agresivos, con acciones claras
 * y un mensaje empático (no culpabiliza al usuario por escribir mal la URL).
 */
export const PaginaNoEncontrada = () => {
  const navigate = useNavigate()

  const irAlInicio = () => {
    void navigate({ to: '/' })
  }

  const volverAtras = () => {
    // Si no hay historial (deep-link directo), caemos al inicio como red de seguridad.
    if (window.history.length > 1) {
      window.history.back()
    } else {
      void navigate({ to: '/' })
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-white p-6">
      <section
        role="alert"
        aria-live="polite"
        className="w-full max-w-xl bg-white rounded-2xl shadow-lg border border-blue-100 p-8 md:p-10 text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700">
          <Compass className="h-10 w-10" aria-hidden="true" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
          Error 404
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-blue-900">
          Página no encontrada
        </h1>
        <p className="mt-4 text-blue-700 text-base leading-relaxed">
          No pudimos ubicar la ruta que buscas. Es posible que el enlace esté
          desactualizado o que la dirección tenga un error de escritura.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Boton
            type="button"
            variante="primario"
            onClick={irAlInicio}
            className="py-3 px-6 rounded-xl"
          >
            <Home className="w-5 h-5 mr-2" aria-hidden="true" />
            Ir al inicio
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            onClick={volverAtras}
            className="py-3 px-6 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 mr-2" aria-hidden="true" />
            Volver atrás
          </Boton>
        </div>
      </section>
    </div>
  )
}