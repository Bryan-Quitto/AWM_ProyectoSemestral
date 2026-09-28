import { AlertTriangle, Home, ArrowLeft } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { Boton } from './Boton'

/**
 * Pantalla dedicada para errores no controlados capturados por el
 * `errorComponent` del router raíz (sustituye al ErrorBoundary por
 * defecto de TanStack Router que mostraba la pantalla técnica
 * "Something went wrong" en la imagen de error reportada).
 *
 * Componente 100% agnóstico (sin lógica de dominio), ubicado en
 * `src/components/` según REGLA-AHA-UI de SKILLS.md.
 *
 * Diseñada para mantener el tono de "salud y tranquilidad" del proyecto:
 * gradiente azul/celeste/blanco, sin rojos agresivos, con acciones
 * claras y un mensaje empático para el cuidador.
 */
export const PaginaError = () => {
  const router = useRouter()

  const irAlInicio = () => {
    void router.navigate({ to: '/' })
  }

  const volverAtras = () => {
    // Si no hay historial (deep-link directo), caemos al inicio como
    // red de seguridad para evitar dejar al usuario en un estado roto.
    if (window.history.length > 1) {
      window.history.back()
    } else {
      void router.navigate({ to: '/' })
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-white p-6">
      <section
        role="alert"
        aria-live="assertive"
        className="w-full max-w-xl bg-white rounded-2xl shadow-lg border border-blue-100 p-8 md:p-10 text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700">
          <AlertTriangle className="h-10 w-10" aria-hidden="true" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
          Error inesperado
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-blue-900">
          Algo no salió como esperábamos
        </h1>
        <p className="mt-4 text-blue-700 text-base leading-relaxed">
          Ocurrió un problema al cargar esta sección. No te preocupes, tus
          datos están seguros. Puedes volver al inicio e intentarlo de nuevo
          en unos momentos.
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
