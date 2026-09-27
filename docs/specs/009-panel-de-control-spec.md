# SPEC — Centro de Control y Monitoreo del Cuidado (Dashboard)

> Vista principal (`/_protegidas/`) que reemplaza el placeholder `Proximamente` por un panel ejecutivo derivado de hooks ya existentes. Sin nuevos endpoints.

---

## 1. Modelo de Datos (derivado, no persistido)

### 1.1 Fuentes SWR (sin cambios backend)

| Hook | Key SWR | Frecuencia | Devuelve |
|---|---|---|---|
| `useNotificacionesResumen()` | `/api/agenda/notificaciones-resumen` | 60s refresh + on focus | `NotificacionesResumen { hoy[], semana[] }` |
| `useDirectorioRelevos({ estado: 'Disponible' })` | `/api/directorio-relevos` (Orval) | keepPreviousData | `RelevoItemResponse[]` |
| `useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint()` | Orval | on focus | `DependienteResumenResponse[]` |
| `useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint()` | Orval | on focus | `MiPerfilResponse { nombre, apellido, ... }` |

### 1.2 Estado Derivado (no se almacena; se computa en cada render)

```ts
type ResumenCuidador = { nombre: string; apellido: string };       // MiPerfilResponse
type DependienteActivo = DependienteResumenResponse;                // primer perfil con rol CuidadorPrincipal

type KpiTurnosHoy = {
  total: number;
  cubiertos: number;     // cuidadorAsignadoNombre !== null && estado !== 'Cancelado'
  sinCubrir: number;
};

type KpiCoberturaSemanal = {
  cubiertos: number;
  pendientes: number;    // cuidadorAsignadoNombre === null && estado === 'Disponible'
};

type KpiRedApoyo = {
  disponibles: number;   // relevos filtrados por estado === 'Disponible'
};

type TurnoEnCurso = NotificacionTurno | null;       // primer item de datos.hoy
type TurnosPendientesSemana = NotificacionTurno[];  // filtrado de datos.semana
```

### 1.3 Concurrencia

- `useNotificacionesResumen` ya trae `refreshInterval: 60_000` y `revalidateOnFocus: true`. **No se duplica polling**.
- El Dashboard **no introduce `useEffect` para sincronizar SWR** (regla React 19): todo KPI se calcula como expresión pura sobre los datos cacheados por SWR. Si los hooks no han llegado, se renderiza el esqueleto.

---

## 2. Cálculo del "Turno en Curso" (lógica núcleo)

```ts
const ahora = new Date();
const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

const parsearHHmm = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// "En curso" = un turno de HOY cuyo intervalo [inicio, fin] contiene a minutosActuales.
// Si no hay ninguno, se muestra el próximo del día (primer item de hoy).
const turnoEnCurso = (datos.hoy ?? []).find((t) => {
  const inicio = parsearHHmm(t.horaInicio);
  const fin = parsearHHmm(t.horaFin);
  return inicio <= minutosActuales && minutosActuales <= fin;
}) ?? (datos.hoy?.[0] ?? null);
```

> El backend ya serializa los horarios en zona `America/Guayaquil`. El navegador opera en su zona local — **riesgo aceptado**: la divergencia solo se materializa si el usuario tiene la zona horaria del SO cambiada. Para el MVP, se documenta con un comentario en el código y se sugiere futuro: inyectar `Date.now()` desde backend en el response.

---

## 3. Estructura de Archivos

```
src/views/Dashboard/
├── DashboardContenedor.tsx       # Bifurcador Mobile/Desktop + composición de hooks
├── DashboardDesktop.tsx          # Grid 12-col, 4 KPIs fila superior + 2 paneles inferiores
├── DashboardMobile.tsx           # Stack vertical, tarjetas full-width, espaciado táctil (gap-4 p-4)
├── TarjetaMetrica.tsx            # Componente agnóstico: {etiqueta, valor, subtexto, icono, tono}
├── EncabezadoEmpatico.tsx        # Saludo dinámico + subtítulo
├── TarjetaTurnoEnCurso.tsx       # Panel central con borde lateral colorido + CTA WhatsApp/Llamar
├── RadarAlertaSemanal.tsx        # Lista de turnos sin asignar + CTA a /agenda
└── BannerRelevoUrgente.tsx       # Banner ámbar inferior con CTA a /directorio-relevos
```

> `TarjetaMetrica.tsx` **se queda en `src/views/Dashboard/`** (no en `components/`) porque solo se usa en esta vista (Regla de 3 NO cumplida para subirlo a `components/`). Se documenta este porqué con un JSDoc en el archivo.

### Modificación única de ruta

`src/routes/_protegidas/index.tsx` — reemplazar `<Proximamente />` por `<DashboardContenedor />`. Sin `politicas.ts` adicionales: la ruta ya exige sesión.

---

## 4. Contrato Visual (Mobile vs Desktop)

| Sección | Desktop (≥768px) | Mobile (<768px) |
|---|---|---|
| Encabezado | `h1` 3xl + subtítulo, ocupa fila completa | `h1` 2xl + subtítulo, stack vertical |
| 4 KPIs | Grid `grid-cols-4 gap-6` | Grid `grid-cols-2 gap-4` |
| Turno en curso | 7 columnas (a la izquierda) | Full-width, alto mínimo 200px |
| Radar semanal | 5 columnas (a la derecha) | Full-width debajo del turno |
| Banner relevo | Full-width, `mt-8` | Full-width, `mt-6` con botones full-width |

**Breakpoint:** `useMediaQuery('(max-width: 768px)')` — mismo criterio que `AgendaContenedor` y `LayoutPrincipal`.

---

## 5. Paleta y Tokens (sin nuevos colores)

- Fondo página: `bg-gradient-to-br from-sky-50 via-white to-blue-50` (consistente con `CargadorPantallaCompleta`).
- Tarjeta base: `bg-white border border-blue-100 rounded-2xl shadow-sm`.
- KPI tono primario: `bg-blue-50 text-blue-900`.
- KPI tono éxito: `bg-emerald-50 text-emerald-900`.
- KPI tono alerta: `bg-amber-50 text-amber-900`.
- KPI tono sistema: `bg-sky-50 text-sky-900`.
- Borde lateral TurnoEnCurso: `border-l-4` con `border-emerald-500` si cubierto, `border-red-400` si sin asignar.
- Banner relevo urgente: `bg-amber-50 border-amber-200`.

---

## 6. Microinteracciones Obligatorias (SKILLS.md)

- Todo `<button>`, `<a>`, `<Link>` → `cursor-pointer`.
- Disabled (N/A en MVP pero se aplica si se condiciona): `disabled:cursor-not-allowed disabled:opacity-50`.
- Hover sobre tarjetas: `hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`.
- CTAs principales: `active:scale-[0.98]`.
- Botón WhatsApp en `TurnoEnCurso` solo se renderiza si `cuidadorAsignadoNombre !== null` Y hay teléfono en la red (para MVP: si `cuidadorAsignadoNombre !== null`, asumimos disponibilidad y mostramos el botón con `construirEnlaceWhatsApp`).

---

## 7. Zero-Wait Policy

- Cada KPI: `animate-pulse` mientras `isLoading`.
- Tarjeta TurnoEnCurso: 3 esqueletos (badge + título + 2 líneas) mientras `isLoading`.
- Radar semanal: 3 filas esqueleto mientras `isLoading`.
- Banner relevo: se renderiza estático inmediatamente (no depende de SWR).

---

## 8. Manejo de Errores

- `error` de cualquier SWR → la tarjeta muestra un toast rojo + fallback "No pudimos cargar el resumen. Reintenta." con botón que llama `mutate()`.
- Estado de SWR `null` (sin datos, ej: usuario nuevo) → KPIs muestran `0`, "Turno en curso" muestra estado sereno "No hay turnos externos programados para hoy. Día de cuidado familiar directo."

---

## 9. i18n / Idioma

- Todo texto visible en **español**.
- Variables, props, interfaces en **español** (`TurnoEnCurso`, `dependienteActivo`, `cuidadoresDisponibles`).
- Strings literales sin plantilla en inglés. Comentarios JSDoc sí pueden ir en español neutro.

---

## 10. Criterios de Aceptación

1. `npm run build` retorna 0 errores de TypeScript y 0 warnings de oxlint.
2. La ruta `/_protegidas/` renderiza el dashboard sin parpadeos (VerificadorPerfil del layout sigue bloqueando hasta confirmar sesión).
3. Sin `useEffect` nuevo dedicado a sincronizar SWR (regla React 19).
4. `TarjetaMetrica` no se importa desde ningún archivo fuera de `src/views/Dashboard/` (abstracción mínima).
5. Bifurcación Mobile/Desktop funcional con resize en vivo.
6. Saludo cambia según `getHours()`: 5–11 "Buenos días", 12–18 "Buenas tardes", 19–4 "Buenas noches".
7. Banner de relevo siempre visible, no depende de SWR.
8. Cada elemento interactivo inspeccionado en DevTools confirma `cursor-pointer`.

---

## 11. Fuera de Alcance (antiobstrucción)

- No se crea endpoint nuevo.
- No se modifica `useNotificacionesResumen` ni `useDirectorioRelevos`.
- No se introduce estado global (Zustand/Context): el contenedor se basta con hooks locales + SWR.
- No se agrega paginación a los KPIs.
- No se rediseña el sidebar ni el layout principal.
- No se tocan tests E2E existentes.
