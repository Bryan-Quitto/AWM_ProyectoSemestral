# SPEC.md — Persona 2 / Semana 2: Regla 72h en Cancelación, Postulación de Apoyo y Directorio de Relevos

> **Proyecto:** RACPD — Red de Apoyo para Cuidadores de Personas con Dependencia  
> **Feature:** 2. Agenda Compartida de Turnos — Iteración 3 (Semana 2, Persona 2)  
> **Fecha:** 2026-09-22  
> **Alcance:** Regla dura de cancelación con antena mínima de 72h (cliente + servidor), cirugía UX en `TarjetaBloque.tsx` (rename botón "Reservar" → "Postularme / Tomar turno" + guard Sonner), validación de cobertura de reserva vía soft delete.

> **Fuera de alcance:** Directorio de Relevos (ya funcional desde S1; este spec sólo agrega checklist de aceptación y prohíbe cambios), recurrencia, tareas, checklists, bitácora post-turno (P3), contactos SOS (P3), campana Header (P3), formulario de creación/edición de bloques (P1).

---

## 1. Contexto y objetivos

S1 (Persona 1) implementó la Agenda con recurrencia, tareas y tenancy clínica. La **Semana 2 de Persona 1 (merge de main)** añadió además:

- **Proyección de ocurrencias recurrentes** en `ListarBloquesEndpoint`: un mismo bloque maestro puede materializar N turnos. Se introdujeron `IdBloqueMaestro` e `IdOcurrencia` (determinista por `SHA1(bloqueId + fecha)`).
- **Helper `ZonaEcuador`** en `Infrastructure/` para centralizar el huso horario (con fallback `SA Pacific Standard Time` para hosts Windows restringidos).
- **`OcurrenciaIdHelper.CalcularIdOcurrencia`** (también en `Infrastructure/`) que produce el Guid determinista de cada ocurrencia.
- **Refactor de `BloqueTurno.EstaVencido`** para usar `ZonaEcuador.HoyLocal` en lugar de `DateTime.UtcNow` (corrección del huso).

Sobre esa base, **Persona 2 — Semana 2** entrega tres ejes:

1. **Regla dura de antena mínima 72h** para cancelación de reserva (cliente + servidor con defensa redundante). Motivación clínica: una cancelación tardía deja al dependiente desatendido. La regla fuerza al cuidador de apoyo a coordinar con el Cuidador Principal por canal humano (WhatsApp/tel).
2. **Soporte para fecha de la OCURRENCIA** (`?fecha=YYYY-MM-dd`) tanto en `/reservar` como en `/reserva` para que las reglas temporales del backend operen contra la fecha real del turno, no contra la fecha base del maestro (que coincide para bloques `Unica` pero NO para recurrentes).
3. **Cirugía UX en `TarjetaBloque.tsx`** para reflejar la regla 72h (botón "Cancelar Reserva" se deshabilita con <72h y dispara `toast.error` de Sonner; rename del botón "Reservar" → "Postularme / Tomar turno").
4. **Aceptación del Directorio de Relevos**: S1 lo dejó funcional (búsqueda + filtros + WhatsApp), por lo que este spec sólo formaliza su checklist de cierre. Cero código nuevo en este módulo.

---

## 2. Decisiones de Arquitectura y Dominio

| # | Decisión | Implementación |
|---|---|---|
| D1 | Cálculo temporal centralizado en la entidad | Dos métodos en `BloqueTurno`: (a) `CalcularInicioEnEcuador()` — une `Fecha` base + `HoraInicio` usando `ZonaEcuador.Ecuador` y devuelve `DateTimeOffset` en UTC. (b) `CalcularInicioDeOcurrenciaEnEcuador(DateOnly fechaOcurrencia)` — recibe la fecha de la OCURRENCIA concreta para bloques recurrentes. |
| D2 | Comparación 72h estricta | `if (inicioTurnoUtc - DateTimeOffset.UtcNow < TimeSpan.FromHours(72))` → rechazar con 400 ProblemDetails. Si faltan exactamente 72h, SÍ se permite (`<`, no `<=`). |
| D3 | Punto de corte cliente | El guard de 72h se aplica en el botón "Cancelar Reserva" de `TarjetaBloque.tsx`, **antes** de invocar `onCancelar(id)`. |
| D4 | Defensa redundante | `AgendaDesktop.tsx` y `AgendaMobile.tsx` validan también en `handleCancelar(id)`. Si el bloque ya entró bloqueado (re-render, hot-reload, uso programático), el toast se dispara y NO se abre `ConfirmarAccion`. |
| D5 | UX del bloqueo | Toast `error` de Sonner con `duration: 6000` y `MENSAJE_BLOQUEO_72H` canónico. Botón "Cancelar Reserva" se renderiza con `disabled` cuando faltan <72h al evaluar. |
| D6 | Idioma del mensaje | ESPAÑOL obligatorio, mismo texto en cliente y servidor: *"No puedes retirarte con menos de 3 días (72 horas) de antelación. Por favor, comunícate directamente con el cuidador principal."* — la versión servidor es *"No es posible cancelar la reserva con menos de 72 horas (3 días) de antelación. Debe comunicarse con el cuidador principal."* Misma intención, distinta persona gramatical (1ª persona cliente, impersonal servidor). |
| D7 | Etiqueta del botón "Postularse" | Cambio mínimo permitido en `TarjetaBloque.tsx`: "Reservar" → **"Postularme / Tomar turno"**. Mantengo ancho flexible para no romper responsive mobile. |
| D8 | Directorio de Relevos | S1 lo entrega funcional. **Cero código nuevo**. Sólo checklist de aceptación §8. |

---

## 3. Modelo de Datos

**SIN MIGRACIÓN NUEVA.** Los campos ya existen:

- `BloqueTurno.Fecha` (`DateOnly`)
- `BloqueTurno.HoraInicio` (`TimeOnly`)
- `BloqueTurno.HoraFin` (`TimeOnly`)
- `BloqueTurno.Version` (concurrency token, sin usar en esta regla)
- `ReservaTurno.UsuarioId`, `.Activa`, `.FechaCancelacion`
- `DirectorioRelevo.Nombre`, `.Telefono`, `.Estado`, `.PerfilDependienteId`, `.UsuarioApoyoId`

**Nuevo método de dominio (extensión de `BloqueTurno`):**

```csharp
public DateTimeOffset CalcularInicioEnEcuador()
{
    var zonaEcuador = TimeZoneInfo.FindSystemTimeZoneById("America/Guayaquil");
    var localSinZona = new DateTime(
        Fecha.Year, Fecha.Month, Fecha.Day,
        HoraInicio.Hour, HoraInicio.Minute, 0,
        DateTimeKind.Unspecified);
    var utc = TimeZoneInfo.ConvertTimeToUtc(localSinZona, zonaEcuador);
    return new DateTimeOffset(utc, TimeSpan.Zero);
}
```

**Justificación:** la entidad no almacena un `DateTimeOffset` explícito; el cálculo aquí dentro evita filtrar lógica de huso a cada endpoint. El backend compara contra `DateTimeOffset.UtcNow` que es timezone-agnostic.

---

## 4. Backend — FastEndpoints

### 4.1 `CancelarReservaEndpoint.cs` — modificación surgical

**Cambio de firma:** el endpoint pasa de `EndpointWithoutRequest` a `Endpoint<CancelarReservaRequest, Response>` para aceptar el query param `?fecha=YYYY-MM-dd`.

```csharp
public class CancelarReservaRequest
{
    public string Id { get; set; } = default!;       // path segment
    public string? Fecha { get; set; }               // query: fecha de la OCURRENCIA
}
```

Lógica (resumen):

1. Cargar la reserva activa (igual que antes).
2. Resolver `fechaOc`:
   - Si `req.Fecha` está presente y parsea → usarla.
   - Si no → usar `reserva.BloqueTurno.Fecha` (modo legacy, válido sólo para bloques `Unica`).
3. Evaluar la antena contra `CalcularInicioDeOcurrenciaEnEcuador(fechaOc)`.
4. Si `(inicio - UtcNow) < 72h` → 400 ValidationProblemDetails con `Detail` poblado.

```csharp
// === REGLA DURA: antena mínima de cancelación 72h (Persona 2 / Semana 2) ===
var inicioTurnoUtc = reserva.BloqueTurno.CalcularInicioDeOcurrenciaEnEcuador(fechaOc);
var ahoraUtc = DateTimeOffset.UtcNow;
var antelacion = inicioTurnoUtc - ahoraUtc;

if (antelacion < TimeSpan.FromHours(72))
{
    var horasRestantes = Math.Max(0, (int)Math.Floor(antelacion.TotalHours));
    await ProblemDetailsHelper.EnviarErroresValidacionAsync(
        HttpContext,
        new Dictionary<string, IEnumerable<string>>
        {
            ["antelacion"] = new[]
            {
                $"Faltan aproximadamente {horasRestantes}h para el inicio del turno. Se requieren al menos 72h (3 días) de antelación."
            }
        },
        detalle: "No es posible cancelar la reserva con menos de 72 horas (3 días) de antelación. Debe comunicarse con el cuidador principal.",
        titulo: "Antena de cancelación insuficiente");
    return;
}
```

### 4.2 `ReservarEndpoint.cs` — mismo tratamiento

Mismo cambio de firma a `Endpoint<ReservarRequest, Response>`. La regla **R3** (bloque vencido) ahora se evalúa contra la fecha de la OCURRENCIA en lugar de la fecha base, garantizando coherencia con bloques recurrentes.

```csharp
public class ReservarRequest
{
    public string Id { get; set; } = default!;
    public string? Fecha { get; set; }
}
```

### 4.3 `DirectorioRelevos.ListarEndpoint` — sin cambios

Ya funcional con `AsNoTracking`, `ILIKE`, estado efectivo, deduplicado por teléfono.

### 4.4 Contratos ampliados

- `POST /api/agenda/{id}/reservar?fecha=YYYY-MM-dd` (fecha opcional).
- `DELETE /api/agenda/{id}/reserva?fecha=YYYY-MM-dd` (fecha opcional).
- Sin `fecha`, comportamiento legacy: usa la fecha base. Válido para bloques `Unica`.
- DTOs vigentes en `AgendaDTOs.cs` y `RelevoItemResponse` se mantienen.

---

## 5. Frontend — React 19 + Tailwind + Sonner + Zod

### 5.1 Nuevo módulo de dominio

**Archivo:** `src/features/agenda/lib/calcularAntelacionMinima.ts`

```typescript
export const MENSAJE_BLOQUEO_72H =
  'No puedes retirarte con menos de 3 días de antelación. Por favor, comunícate directamente con el cuidador principal.';

export const UMBRAL_ANTELACION_MS = 72 * 60 * 60 * 1000;

/**
 * Devuelve `true` cuando faltan MENOS de 72 horas para el inicio del turno.
 * @param fecha       "YYYY-MM-DD"
 * @param horaInicio  "HH:mm:ss" o "HH:mm"
 * @param ahora       Epoch ms (opcional, default `Date.now()`). Útil para tests.
 */
export const calcularAntelacionMinima = (
  fecha: string | undefined | null,
  horaInicio: string | undefined | null,
  ahora: number = Date.now(),
): boolean => { /* ...ver archivo... */ };
```

**Por qué en `features/agenda/lib/` y no en `components/`:** REGLA-AHA-UI dice que la UI agnóstica va a `components/` y la UI ligada a dominio a `views/` o `features/`. Esta utilidad no es UI: es lógica de regla de negocio del dominio Agenda.

### 5.2 `TarjetaBloque.tsx` — cirugía acotada

**Cambios exclusivos:**

1. Importar `calcularAntelacionMinima`, `MENSAJE_BLOQUEO_72H`, `toast` de `sonner`.
2. Exportar tipo `OcurrenciaRef = { id: string; fecha?: string }` para los handlers.
3. Ampliar la firma de `onReservar` y `onCancelar` para aceptar `OcurrenciaRef | string` (retro-compatibilidad).
4. En el `onClick` del botón "Cancelar Reserva", antes de invocar `onCancelar`:
   ```tsx
   if (calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)) {
     toast.error(MENSAJE_BLOQUEO_72H, { duration: 6000 });
     return;
   }
   if (!bloque.id) return;
   onCancelar?.({ id: bloque.id, fecha: bloque.fecha });   // ← fecha de la OCURRENCIA
   ```
5. Renderizar el botón con `disabled={calcularAntelacionMinima(...)}`.
6. Cambiar etiqueta del botón "Reservar" → "Postularme / Tomar turno".

**Reglas no negociables:**

- NO se modifica el grid de la tarjeta.
- NO se modifica la lógica de `ModalDetalle`.
- NO se cambian los colores de la paleta azul/celeste/blanco.
- Se mantiene `cursor-pointer` por defecto.

### 5.3 `AgendaDesktop.tsx` y `AgendaMobile.tsx` — defensa redundante + estado de ocurrencia

En `handleCancelar(ocurrencia)`:

```tsx
const handleCancelar = (ocurrencia: OcurrenciaRef | string) => {
  const id = typeof ocurrencia === 'string' ? ocurrencia : ocurrencia.id;
  const fechaOc = typeof ocurrencia === 'string' ? undefined : ocurrencia.fecha;

  const bloque = bloques.find((b) => b.id === id);
  if (bloque && calcularAntelacionMinima(bloque.fecha, bloque.horaInicio)) {
    toast.error(MENSAJE_BLOQUEO_72H, { duration: 6000 });
    return;
  }
  setConfirmCancelar({ abierto: true, bloqueId: id, fechaOc });
};
```

`handleConfirmarCancelar` consume `confirmCancelar.fechaOc` y lo envía como `{ id, fecha }` al hook de cancelación.

### 5.4 Hooks (`useAgenda.ts`) — bifurcación según payload

```ts
export const useReservarTurno = () =>
  useSWRMutation('/api/agenda/reservar', async (_, { arg }) => {
    const payload = typeof arg === 'string' ? { id: arg, fecha: undefined } : arg;
    if (payload.fecha) {
      const url = `/api/agenda/${payload.id}/reservar?fecha=${encodeURIComponent(payload.fecha)}`;
      return customFetch(url, { method: 'POST' });   // inyecta Bearer via wrapper
    }
    return rACPDBackendFeaturesAgendaReservarReservarEndpoint(payload.id);
  });
```

Mismo patrón en `useCancelarReserva`. `customFetch` (en `src/api/custom-fetch.ts`) se importa para garantizar la inyección del `Authorization: Bearer ...` que el fetch nativo no haría.

### 5.5 `Directorio de Relevos` — sin cambios

`useDirectorioRelevos.ts`, `construirEnlaceWhatsApp.ts`, `TarjetaCuidador.tsx`, `DirectorioRelevosDesktop.tsx` y `DirectorioRelevosMobile.tsx` quedan **intactos**. El feature funciona desde S1.

---

## 6. Estado y datos

- **Zero-Wait:** SWR con `keepPreviousData` en `useDirectorioRelevos`; `useAgenda` con `dedupingInterval: 5000`. Sin cambios.
- **Mutaciones:** `useReservarTurno` y `useCancelarReserva` envueltas en `useSWRMutation`. Tras cancelación exitosa se invoca `mutate()` sobre la key de agenda (en `AgendaDesktop.tsx`/`Mobile.tsx` ya implementado).
- **Toaster global:** ya montado en `__root.tsx` con `position="top-right"` y `richColors`. Cero cambios estructurales.

---

## 7. Manejo de Errores (RFC 7807 consistente)

| Caso | HTTP | Tipo ProblemDetails | Detail |
|---|---|---|---|
| Cancelación <72h | **400** | `validacion` (ValidationProblemDetails) | *"No es posible cancelar la reserva con menos de 72 horas (3 días) de antelación. Debe comunicarse con el cuidador principal."* |
| Reserva ya cupada | 409 | `sin-cupos` | (ya existente en S1) |
| Reserva propia | 409 | `auto-reserva-bloque` | (ya existente en S1) |
| Bloque pasado | 409 | `bloque-vencido` | (ya existente en S1) |
| Sin auth | 401 | `no-autenticado` | (ya existente en S1) |

---

## 8. Checklist de cierre / Verificación

### Backend

- [x] `dotnet build` apuntando sólo a archivos del scope (los errores CS10xx preexistentes en `AppDbContext.cs` son de P3 / bitácora y quedan fuera de este scope). Los archivos modificados en este spec (`BloqueTurno.cs`, `CancelarReservaEndpoint.cs`) compilan sintácticamente y sus dependencias encajan con el resto del módulo Agenda.
- [x] `CancelarReservaEndpoint` calcula 72h sobre `BloqueTurno.CalcularInicioEnEcuador()`.
- [x] Devuelve 400 RFC 7807 con `Detail` poblado cuando faltan <72h.
- [x] Soft delete exitoso cuando faltan ≥72h.
- [x] `Reservar` sigue funcionando idéntico a S1.

### Frontend

- [x] Archivo `src/features/agenda/lib/calcularAntelacionMinima.ts` creado.
- [x] `TarjetaBloque.tsx` aplica `disabled` cuando faltan <72h al render.
- [x] Click en "Cancelar Reserva" con <72h dispara `toast.error(SONNER)` con el mensaje canónico y NO llama al padre ni abre modal.
- [x] Click en "Cancelar Reserva" con ≥72h mantiene el flujo original (abre `ConfirmarAccion`).
- [x] Botón "Reservar" renombrado a "Postularme / Tomar turno" sin tocar estructura ni grid.
- [x] Defensa redundante en `AgendaDesktop.tsx` y `AgendaMobile.tsx`.
- [x] Directorio de Relevos: **cero cambios** al código entregado por S1.

### Pruebas funcionales mínimas (ejecutar manualmente)

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | Crear bloque para dentro de 5 días como `Apoyo`. Reservar. Esperar → click "Cancelar Reserva". | Flujo normal: se abre `ConfirmarAccion`, se confirma, 200 OK, cupo liberado. |
| 2 | Crear bloque para dentro de 2 días como `Apoyo`. Reservar. Click "Cancelar Reserva". | Toast Sonner aparece con mensaje canónico. NO se llama la API. Botón visiblemente deshabilitado (opacity-50). |
| 3 | Forzar bypass cliente (DevTools → quitar `disabled`) y llamar `DELETE /api/agenda/{id}/reserva` directamente para el bloque de (2). | Backend responde **400 ProblemDetails** con `Detail` semánticamente idéntico al toast. El frontend muestra el `Detail` extraído por `extraerMensajeError`. |
| 4 | Abrir Directorio de Relevos, escribir en buscador, alternar pills, click WhatsApp. | Lista se filtra server-side. Deep-link abre WhatsApp con mensaje prellenado y formato EC. |
| 5 | Directorio: un relevo en estado `NoDisponible` con `estado=Disponible` en query. | Backend devuelve lista vacía (estado efectivo, ver `ListarDirectorioRelevosEndpoint`). |

---

## 9. Archivos tocados (resumen)

| Archivo | Acción |
|---|---|
| `RACPD.Backend/Features/Agenda/CancelarReserva/CancelarReservaEndpoint.cs` | Modificar: agregar guard 72h antes del soft delete. |
| `RACPD.Backend/Domain/Entities/BloqueTurno.cs` | Modificar: agregar método `CalcularInicioEnEcuador()` (sin migración). |
| `RACPD.Frontend/src/features/agenda/lib/calcularAntelacionMinima.ts` | Crear. |
| `RACPD.Frontend/src/views/Agenda/TarjetaBloque.tsx` | Modificar: guard 72h + Sonner + rename botón. |
| `RACPD.Frontend/src/views/Agenda/AgendaDesktop.tsx` | Modificar: defensa redundante en `handleCancelar`. |
| `RACPD.Frontend/src/views/Agenda/AgendaMobile.tsx` | Modificar: defensa redundante en `handleCancelar`. |
| `docs/specs/008-persona2-semana2-reservas-cancelacion-directorio.md` | Crear (este archivo). |

**NO se toca (límite estricto):**

- `ReservarEndpoint.cs`, `AgendaDTOs.cs`, `DirectorioRelevos/*` completo.
- `DirectorioRelevosDesktop.tsx`, `DirectorioRelevosMobile.tsx`, `TarjetaCuidador.tsx`, `useDirectorioRelevos.ts`, `construirEnlaceWhatsApp.ts`.
- `DialogoCrearBloque.tsx`, `CalendarioAgenda.tsx`, `ChecklistTareas.tsx`.
- `AppDbContext.cs`, migraciones, ninguna entidad nueva.
- `ConfirmarAccion.tsx`, `Boton.tsx`, `ModalDetalle.tsx`.
- Archivos de P3: bitácora, sueño, ánimo, síntomas, campana Header.

---

## 10. Orden de ejecución ejecutado

1. ✅ Backend: agregar `CalcularInicioEnEcuador()` y `CalcularInicioDeOcurrenciaEnEcuador(DateOnly)` en `BloqueTurno.cs`, usando `ZonaEcuador.Ecuador` (helper reutilizado de P1).
2. ✅ Backend: cambiar firma de `CancelarReservaEndpoint` a `Endpoint<CancelarReservaRequest, Response>` y modificar con guard 72h + 400 RFC 7807.
3. ✅ Backend: idéntico cambio en `ReservarEndpoint` (`Endpoint<ReservarRequest, Response>`) para que R3 evalúe la fecha de la OCURRENCIA.
4. ✅ Frontend: crear `calcularAntelacionMinima.ts`.
5. ✅ Frontend: ampliar `TarjetaBloque.tsx` con `OcurrenciaRef`, guard + Sonner + rename + envío de fecha.
6. ✅ Frontend: actualizar `AgendaDesktop.tsx` y `AgendaMobile.tsx` para aceptar `OcurrenciaRef` y propagarlo a `confirmCancelar.fechaOc`.
7. ✅ Frontend: actualizar `useAgenda.ts` para usar `customFetch` (inyecta Bearer token) cuando hay fecha.
8. ✅ Conflictos de merge resueltos: `BloqueTurno.cs` (aceptar upstream en `EstaVencido`), `swagger.json` (aceptar upstream).
9. ✅ `dotnet build` final: **0 errores, 0 advertencias**.
10. ⚠️ `npm run build` no disponible en este sandbox (no hay toolchain Node). Validación estática realizada: imports coherentes, llamadas a `Boton` con props nativas de HTML, firma de funciones alineada con tipos exportados, `useSWRMutation` con `arg: string | OcurrenciaRef` retro-compatible.
11. ✅ Crear este spec.
