import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AgendaContenedor } from '../../views/Agenda/AgendaContenedor'
import { protegerRutaPorRol } from '../../autenticacion/politicas'

/**
 * Schema de search params de la Agenda.
 *
 * Soporta el "deep-link" desde el Dashboard: cuando el cuidador hace click
 * en "Ver detalles" (TarjetaTurnoEnCurso) o "Gestionar" (RadarAlertaSemanal),
 * navegamos a `/agenda?bloqueIdDestacado=<guid>`. La AgendaContenedor lee este
 * param, busca el bloque en el mes correspondiente, fuerza el scroll y aplica
 * el anillo pulsante durante 3s.
 *
 * Mantenerlo como string (no UUID tipado) evita errores de validación cuando
 * el cuidador comparte un enlace manipulado: el search param es solo una
 * pista de UI, no una credencial ni un input de mutación.
 */
const agendaSearchSchema = z.object({
  bloqueIdDestacado: z.string().min(1).max(64).optional(),
})

export const Route = createFileRoute('/_protegidas/agenda')({
  // Solo CuidadorPrincipal y Apoyo acceden a la agenda. El Administrador
  // del sistema no tiene acciones funcionales aquí, por lo que mantener
  // su acceso generaba "acceso vacío". Si fuerza la URL → toast + redirect.
  beforeLoad: async ({ location }) => {
    await protegerRutaPorRol(location.pathname)
  },
  validateSearch: (search) => agendaSearchSchema.parse(search),
  component: function AgendaRoute() {
    // Leemos el search param aquí (no dentro de AgendaContenedor) porque
    // TanStack Router solo expone useSearch a archivos Route. Lo pasamos
    // como prop para que el contenedor (que decide Desktop/Mobile) lo
    // propague a las vistas.
    //
    // Tipado: `Route.useSearch()` infiere su tipo de retorno desde
    // `validateSearch` gracias al `Register` declarado en `main.tsx`.
    // El cast NO es necesario en `vite dev`/`vite build`; sin embargo
    // `tsc -b` standalone puede perder la inferencia porque no procesa
    // el plugin Vite. Para blindar el build de CI usamos un type-guard
    // explícito sobre el schema de Zod: extraemos el bloqueId con
    // `safeParse` y, si falla (URL manipulada), caemos a `undefined`.
    const rawSearch = Route.useSearch();
    const parsed = agendaSearchSchema.safeParse(rawSearch);
    const bloqueIdDestacado = parsed.success ? parsed.data.bloqueIdDestacado : undefined;
    return (
      <div className="h-full">
        <AgendaContenedor bloqueIdDestacado={bloqueIdDestacado} />
      </div>
    );
  },
})