/**
 * Pantalla de carga a pantalla completa.
 *
 * Pensada para momentos críticos donde el cuidador NO debe ver la UI
 * "a medias" (ej: pantalla principal antes de confirmar /completar-perfil
 * o mientras se refresca la sesión). Usa la paleta de salud definida en
 * SKILLS.md (azul / celeste / blanco) y respeta el contraste WCAG AA.
 */
type Propiedades = {
  texto?: string
}

export const CargadorPantallaCompleta = ({ texto = 'Cargando…' }: Propiedades) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={texto}
      data-testid="cargador-pantalla-completa"
      className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-blue-100"
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div
          aria-hidden="true"
          className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-blue-600"
        />
        <p className="max-w-xs text-sm font-medium text-blue-900/80 sm:text-base">
          {texto}
        </p>
      </div>
    </div>
  )
}
