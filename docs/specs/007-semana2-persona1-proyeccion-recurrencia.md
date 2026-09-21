# SPEC.md — Persona 1 / Semana 2: Proyección de Recurrencia en Agenda y Checklist Dinámica

> **Proyecto:** RACPD — Red de Apoyo para Cuidadores de Personas con Dependencia
> **Feature:** 2. Agenda Compartida de Turnos — Iteración 3 (Semana 2, Persona 1 — Bryan Quitto)
> **Fecha:** 2026-09-21
> **Alcance:** Algoritmo de proyección de ocurrencias en `GET /api/agenda` (FastEndpoints) para tipos `Indefinida` y `Semanas` (1..24), conservando el almacenamiento de un único registro maestro en PostgreSQL. En el frontend: endurecimiento de la checklist dinámica y sincronización reactiva de la recurrencia en el diálogo de creación/edición.

---

## 1. Contexto y Objetivos

La Semana 1 ([spec-006](006-agenda-recurrencia-tareas-tenancy.md)) dejó modelada la recurrencia en el dominio (`TipoRecurrencia`, `IntervaloSemanas`) y persistida en Postgres, pero **deliberadamente diferió** la proyección de ocurrencias. La consulta actual en `ListarBloquesEndpoint` filtra estrictamente por fecha:

```csharp
.Where(b => b.Fecha >= fechaDesde && b.Fecha <= fechaHasta)
```

Esto excluye cualquier bloque maestro recurrente cuya `Fecha` original sea anterior a `fechaDesde`, aún cuando sus repeticiones caen dentro del rango consultado. El cuidador no ve turnos que **sí existen operativamente**, rompiendo la Agenda Compartida.

Esta entrega cubre tres ejes:

1. **Algoritmo de proyección en memoria** dentro de `GET /api/agenda` para los tipos `Indefinida` y `Semanas (1..24)`, sin duplicar registros en Postgres.
2. **Identificador estable de ocurrencia** (`IdOcurrencia`) determinista y único por par `(IdBloqueMaestro, FechaOc)` para que el frontend pueda operar sobre una instancia específica sin ambigüedad.
3. **Endurecimiento UX** de la checklist dinámica de tareas y del microcopy de recurrencia, validando el mínimo de 1 / máximo de 20 tareas con microinteracciones de error (`border-red-300 focus:ring-red-500`) y mensaje visible.

> **Fuera de alcance:** Edición/eliminación de una **ocurrencia específica** (eso es Semana 3 / Persona 2). Reservar sigue operando contra `BloqueTurnoId` maestro en esta iteración.

---

## 2. Decisiones de Arquitectura y Dominio

| # | Decisión | Justificación |
|---|---|---|
| 1 | Proyección 100 % en memoria (no `LATERAL JOIN` SQL) | El conjunto de maestros recurrentes por usuario es pequeño (decenas, no miles); el algoritmo es trivial con `DateOnly.AddDays`. Evita acoplar Postgres al algoritmo de recurrencia y mantiene el One-Trip Pattern. |
| 2 | Huso horario estricto `America/Guayaquil` | `BloqueTurno.Fecha` es `DateOnly`. Operamos con `AddDays(int)` — día calendario, sin desfase UTC. Coherente con regla SKILLS.md §3. |
| 3 | `IdOcurrencia` determinista (SHA-1 → primeros 16 bytes → GUID) | Estable, reproducible, sin colisiones prácticas para el dominio (espacio 2¹²⁸). Permite que UI y backend convengan la misma llave sin guardar estado adicional. |
| 4 | Tope defensivo de iteraciones | 366 ocurrencias por maestro `Indefinida` (≈ 7 años semanales); 96 para `Semanas` (24 semanas × 4 años). Evita bucles infinitos accidentales si una fecha base errónea pasa filtros. |
| 5 | Filtros aplicados **después** de proyectar | `MisBloques` / `MisReservas` / `Disponibles` se evalúan sobre la lista proyectada. Mantiene un solo trip a BD. |
| 6 | Cero migraciones EF Core nuevas | Toda la información de recurrencia ya está persistida (spec-006). No tocamos el modelo de datos. |
| 7 | Errores HTTP estrictamente RFC 7807 | Mantenemos `ProblemDetailsHelper`. Esta iteración no introduce errores nuevos. |
| 8 | Checklist UX: validación reactiva tras submit | El borde rojo y mensaje aparecen cuando `tareas.length === 0` **y** `form.formState.submitCount > 0`. Cero falsos positivos en el primer render. |

---

## 3. Lenguaje Ubicuo

| Español oficial | Prohibido | Definición |
|---|---|---|
| **Bloque de turno** | shift, slot, slot de turno | Entidad persistente en BD. |
| **Bloque maestro** | bloque padre, parent | Bloque de turno original del cual se derivan ocurrencias. |
| **Ocurrencia proyectada** | repetición virtual, instancia fantasma | Materialización calculada de un maestro en una fecha específica. |
| **IdOcurrencia** | occurrenceId, virtualId | GUID determinista `SHA1(idMaestro \| fecha)`[0..16]. Identifica **una** ocurrencia. |
| **IdBloqueMaestro** | parentId | Copia del `BloqueTurno.Id`. Para acciones que afectan al maestro completo. |
| **TipoRecurrencia** | recurrenceType | Enum: `Unica`, `Indefinida`, `Semanas`. |
| **Agenda Compartida** | calendar, schedule | Vista única que une turnos propios, reservados y disponibles. |
| **Microcopy** | tooltip, helper text | Texto de apoyo visible bajo un control. |

---

## 4. Modelo de Datos

### 4.1 Backend — Sin migración nueva

`BloqueTurno` se mantiene idéntico a spec-006.

### 4.2 DTO `BloqueTurnoDto` (extensión compatible)

Archivo: `RACPD.Backend/Features/Agenda/AgendaDTOs.cs`

```csharp
public record BloqueTurnoDto(
    Guid Id,                          // Compatibilidad: apunta al maestro (legacy).
    Guid IdBloqueMaestro,             // NUEVO: explícito y semántico.
    Guid IdOcurrencia,                // NUEVO: determinista por (IdBloqueMaestro, FechaOc).
    string Fecha,
    string HoraInicio,
    string HoraFin,
    int CuposMaximos,
    int CuposDisponibles,
    string? Descripcion,
    UsuarioResumenDto CreadoPor,
    IReadOnlyList<ReservaTurnoDto> Reservas,
    bool PuedoReservar,
    bool YaReservé,
    Guid PerfilDependienteId,
    string NombreDependiente,
    string TipoRecurrencia,
    int? IntervaloSemanas,
    IReadOnlyList<TareaTurnoDto> Tareas
);
```

> **Nota de compatibilidad:** `Id` se conserva igual a `IdBloqueMaestro` para no romper `TarjetaBloque` ni reservas actuales. La UI recibirá los 3 IDs y elegirá cuál enviar en próximas iteraciones.

### 4.3 Helper de IdOcurrencia

Nuevo archivo: `RACPD.Backend/Infrastructure/OcurrenciaIdHelper.cs`

```csharp
using System.Security.Cryptography;
using System.Text;

namespace RACPD.Backend.Infrastructure;

/// <summary>
/// Genera un GUID determinista y estable para identificar una ocurrencia
/// proyectada de un bloque maestro. No requiere estado en BD.
/// Espacio: 128 bits derivados de SHA-1 (16 primeros bytes).
/// </summary>
public static class OcurrenciaIdHelper
{
    public static Guid CalcularIdOcurrencia(Guid idBloqueMaestro, DateOnly fechaOc)
    {
        var semilla = $"{idBloqueMaestro:N}|{fechaOc:yyyy-MM-dd}";
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(semilla));
        var hex = Convert.ToHexString(hash, 0, 16).ToLowerInvariant(); // 32 chars
        return Guid.ParseExact(hex, "N");
    }
}
```

---

## 5. Backend — Algoritmo de Proyección

### 5.1 Endpoint tocado

`RACPD.Backend/Features/Agenda/Listar/ListarBloquesEndpoint.cs`

### 5.2 Estrategia de consulta (un solo trip a Postgres)

```csharp
var candidatas = await _dbContext.BloquesTurno
    .AsNoTracking()
    .Include(b => b.CreadoPor)
    .Include(b => b.PerfilDependiente)
    .Include(b => b.Reservas).ThenInclude(r => r.Usuario)
    .Where(b =>
        (b.TipoRecurrencia == TipoRecurrencia.Unica
            && b.Fecha >= fechaDesde && b.Fecha <= fechaHasta)
        || (b.TipoRecurrencia != TipoRecurrencia.Unica
            && b.Fecha <= fechaHasta))
    .ToListAsync(ct);
```

Restricciones evaluadas:
- `Unica` → solo dentro del rango (no hay proyección).
- `Indefinida` / `Semanas` → maestra con `Fecha <= fechaHasta`. La maestra anterior a `fechaDesde` sí entra; se proyectan todas las ocurrencias >= `fechaDesde`.

### 5.3 Algoritmo de proyección en memoria

```csharp
var ocurrencias = new List<(BloqueTurno Maestro, DateOnly FechaOc)>();

foreach (var b in candidatas)
{
    switch (b.TipoRecurrencia)
    {
        case TipoRecurrencia.Unica:
            if (b.Fecha >= fechaDesde && b.Fecha <= fechaHasta)
                ocurrencias.Add((b, b.Fecha));
            break;

        case TipoRecurrencia.Indefinida:
            {
                var iter = 0;
                for (var d = b.Fecha; d <= fechaHasta; d = d.AddDays(7))
                {
                    if (d >= fechaDesde) ocurrencias.Add((b, d));
                    if (++iter > 366) break; // tope defensivo ≈ 7 años
                }
            }
            break;

        case TipoRecurrencia.Semanas when b.IntervaloSemanas is int n && n is >= 1 and <= 24:
            {
                var paso = n * 7;
                var iter = 0;
                for (var d = b.Fecha; d <= fechaHasta; d = d.AddDays(paso))
                {
                    if (d >= fechaDesde) ocurrencias.Add((b, d));
                    if (++iter > 96) break; // 24 semanas × 4 años
                }
            }
            break;
    }
}
```

### 5.4 Filtros en memoria (sobre ocurrencias)

```csharp
IEnumerable<(BloqueTurno M, DateOnly F)> filtradas = filtro switch
{
    "MisBloques"   when esPrincipal => ocurrencias.Where(o => o.M.CreadoPorId == usuarioId),
    "MisReservas"  => ocurrencias.Where(o => o.M.Reservas.Any(r => r.Activa && r.UsuarioId == usuarioId)),
    "Disponibles"  => ocurrencias.Where(o => o.M.CuposMaximos > o.M.Reservas.Count(r => r.Activa)),
    _              => ocurrencias
};
```

### 5.5 Mapeo a DTO con `IdOcurrencia`

```csharp
var bloquesDto = filtradas
    .OrderBy(o => o.F).ThenBy(o => o.M.HoraInicio)
    .Select(o =>
    {
        var b = o.M;
        var reservasActivas = b.Reservas.Where(r => r.Activa).ToList();
        var miReserva = reservasActivas.FirstOrDefault(r => r.UsuarioId == usuarioId);
        var esMiBloque = b.CreadoPorId == usuarioId;
        var cuposDisponibles = b.CuposMaximos - reservasActivas.Count;
        var puedoReservar = !esMiBloque && !b.EstaVencido && cuposDisponibles > 0 && miReserva == null;
        var idOc = OcurrenciaIdHelper.CalcularIdOcurrencia(b.Id, o.F);

        return new BloqueTurnoDto(
            Id: b.Id,
            IdBloqueMaestro: b.Id,
            IdOcurrencia: idOc,
            Fecha: o.F.ToString("yyyy-MM-dd"),         // ← fecha PROYECTADA, no b.Fecha
            HoraInicio: b.HoraInicio.ToString("HH:mm:ss"),
            HoraFin: b.HoraFin.ToString("HH:mm:ss"),
            CuposMaximos: b.CuposMaximos,
            CuposDisponibles: cuposDisponibles,
            Descripcion: b.Descripcion,
            CreadoPor: new UsuarioResumenDto(b.CreadoPor.Id,
                $"{b.CreadoPor.Nombre} {b.CreadoPor.Apellido}".Trim()),
            Reservas: reservasActivas.Select(r => new ReservaTurnoDto(
                r.Id,
                new UsuarioResumenDto(r.Usuario.Id,
                    $"{r.Usuario.Nombre} {r.Usuario.Apellido}".Trim()),
                r.UsuarioId == usuarioId)).ToList(),
            PuedoReservar: puedoReservar,
            YaReservé: miReserva != null,
            PerfilDependienteId: b.PerfilDependienteId,
            NombreDependiente: b.PerfilDependiente?.NombreCompleto ?? string.Empty,
            TipoRecurrencia: b.TipoRecurrencia.ToString(),
            IntervaloSemanas: b.IntervaloSemanas,
            Tareas: (b.Tareas ?? new List<TareaTurnoItem>())
                .OrderBy(t => t.Orden)
                .Select(t => new TareaTurnoDto(t.Id, t.Descripcion, t.Orden))
                .ToList()
        );
    }).ToList();
```

### 5.6 Reglas SKILLS.md que valida este endpoint

- ✅ Idiomas 100 % español (variables, parámetros, mensajes).
- ✅ RFC 7807 estricto (vía `ProblemDetailsHelper` existente).
- ✅ Zero-Indulgence EF: un solo trip, sin `SplitQuery`, sin doble `FirstOrDefault` dentro de `Select`.
- ✅ Sin colecciones inicializadas con `[]` en records posicionales (`BloqueTurnoDto` permanece record posicional; las inicializaciones se hacen **dentro** de la expresión `Select` con `new List<>()` o `?? new()`).
- ✅ Cero `as any` / `!` innecesarios.
- ✅ Huso horario Ecuador: `DateOnly.AddDays(int)`, sin `DateTime.ToUniversalTime()`.

---

## 6. Frontend — Checklist Dinámica + Sincronización Reactiva

### 6.1 Archivos a tocar

- `RACPD.Frontend/src/views/Agenda/ChecklistTareas.tsx`
- `RACPD.Frontend/src/views/Agenda/DialogoCrearBloque.tsx`

### 6.2 Checklist (`ChecklistTareas.tsx`)

**Cambios:**

1. Nueva prop `intentoEnviar: boolean` (derivada de `form.formState.submitCount > 0`).
2. Cuando `tareas.length === 0 && intentoEnviar`:
   - Borde del input: `border-red-300 focus:ring-red-500 focus:border-red-500`.
   - Render debajo del input: `<p className="text-red-500 text-sm mt-1">Debe agregar al menos una tarea para el bloque de turno</p>`.
3. Microinteracciones invariantes (ya existentes): `cursor-pointer`, `disabled:cursor-not-allowed`, `disabled:opacity-50`.
4. `Enter` agrega, botón `+` agrega, `Esc` y `X` cancelan edición inline — todo conservado.

**Borrador de interface:**
```ts
interface ChecklistTareasProps {
  tareas: TareaFormValue[];
  onChange: (tareas: TareaFormValue[]) => void;
  disabled?: boolean;
  error?: string;
  intentoEnviar: boolean; // ← NUEVO
}
```

**Lógica derivada (en el componente):**
```ts
const mostrarErrorVacio = intentoEnviar && tareas.length === 0;
```

### 6.3 Diálogo (`DialogoCrearBloque.tsx`)

**Cambios:**

1. Pasar a `<ChecklistTareas ... intentoEnviar={form.formState.submitCount > 0} />`.
2. Microcopy para `Semanas` (simétrico al de `Indefinida`):
   ```tsx
   {tipoRecurrencia === 'Semanas' && (
     <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1.5">
       <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
       <span>
         Se repetirá cada{' '}
         <span className="font-medium">{intervaloSemanas ?? '—'} semanas</span>,
         los <span className="font-medium">{obtenerNombreDiaSemana(fechaForm ?? '')}</span>.
       </span>
     </p>
   )}
   ```
3. El microcopy de `Indefinida` ya está bien: usa `new Date(year, month-1, day)` (sin desfase UTC) ✔️.
4. Sincronización reactiva: `useWatch` ya mantiene `tipoRecurrencia` y `fechaForm`. Cero `useEffect` para sincronizar — regla Zero-Indulgence React ✔️.

### 6.4 Generación de tipos Orval (obligatoria)

Como cambian los DTOs (`IdBloqueMaestro`, `IdOcurrencia`), **no** se editan los archivos generados a mano. Flujo:

```bash
npm run api:generate
# Equivale a: swagger:export (compila backend en puerto efímero + exporta OpenAPI) → orval.
```

Este paso regenera `RACPD.Frontend/src/api/generated/**` con los nuevos campos.

### 6.5 Reglas SKILLS.md que valida este frontend

- ✅ Sin `as any`, sin `!` no justificados, sin tipos a mano en `model.ts` generados.
- ✅ Componente de dominio (`ChecklistTareas`) permanece en `views/Agenda/` (no se promueve a `components/`).
- ✅ Microinteracciones: `cursor-pointer`, `disabled:cursor-not-allowed`, `disabled:opacity-50`.
- ✅ Paleta azul/celeste/blanco mantenida.
- ✅ Huso horario Ecuador: parseo seguro de fechas en microcopy.
- ✅ Estado derivado (no `useEffect` para sincronizar form).
- ✅ Cero `useEffect` para sincronizar datos SWR con estado local.

---

## 7. Verificación y Criterios de Aceptación

### 7.1 Compilación

```bash
# Backend
cd RACPD.Backend
dotnet build                          # 0 warnings, 0 errors.

# Frontend
cd RACPD.Frontend
npm run api:generate                  # Regenera tipos desde el OpenAPI del backend.
npm run build                         # 0 errores de TypeScript, 0 errores de lint.
```

### 7.2 Sanity tests manuales

| Caso | Resultado esperado |
|---|---|
| Crear bloque `Indefinida` con fecha de ayer. Consultar `GET /api/agenda?fechaDesde=hoy&fechaHasta=hoy+30`. | Aparece 1 ocurrencia con `Fecha = hoy`. |
| Crear bloque `Semanas (n=2)` con fecha de hace 14 días. Consultar rango de 30 días. | Aparecen 2 ocurrencias (semana 0 y semana 2). |
| Crear bloque `Unica` con fecha de ayer. Consultar rango futuro. | No aparece ninguna ocurrencia. |
| Filtrar `MisBloques` sobre un recurrente que es propio. | Aparece la(s) ocurrencia(s) del maestro propio dentro del rango. |
| Eliminar todas las tareas del formulario y dar "Crear". | El input y el mensaje muestran borde/texto rojo. No se envía. |
| Seleccionar `Indefinida` con fecha `2026-09-21`. | Microcopy dice: "Este turno se repetirá todos los **lunes** de forma indefinida." (sin desfase UTC). |
| Seleccionar `Semanas (n=3)` con fecha `2026-09-21`. | Microcopy dice: "Se repetirá cada **3 semanas**, los **lunes**." |

### 7.3 Checklist de aceptación

- [ ] `dotnet build` sin warnings ni errors.
- [ ] `npm run build` sin errors de TS/lint.
- [ ] Tipos generados por Orval contienen `idBloqueMaestro` y `idOcurrencia`.
- [ ] Backend proyecta correctamente `Indefinida` y `Semanas (1..24)`.
- [ ] Filtros `MisBloques` / `MisReservas` / `Disponibles` funcionan sobre ocurrencias.
- [ ] Frontend muestra borde y mensaje rojo en checklist vacía tras submit.
- [ ] Microcopys de `Indefinida` y `Semanas` muestran el día correcto sin desfase UTC.

---

## 8. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Topes defensivos (366/96) podrían ocultar datos legítimos en rangos > 7 años. | Documentado en código; el rango UI por defecto es 30 días (spec-006). Si se requiere > 1 año, abrir issue y reconsiderar topes. |
| `IdOcurrencia` determinista colisiona si dos maestros tienen el mismo Guid (improbable, pero…). | Guid de maestro es único por construcción (`Guid.NewGuid()`). Probabilidad de colisión ≈ 0. |
| Cambios en DTO rompen la UI actual (`TarjetaBloque`, `AgendaDesktop`, `AgendaMobile`). | `Id` se conserva apuntando al maestro → nada existente se rompe. Los nuevos campos son aditivos. |
| `npm run api:generate` requiere que el backend compile. | La tarea de implementación incluye primero `dotnet build` para detectar errores antes de regenerar tipos. |

---

## 9. Plan de Implementación (orden estricto)

1. **Backend**: editar `ListarBloquesEndpoint.cs` con el algoritmo descrito en §5. Validar con `dotnet build`.
2. **DTO**: extender `BloqueTurnoDto` con `IdBloqueMaestro` y `IdOcurrencia`. Crear `OcurrenciaIdHelper.cs`. `dotnet build` → 0/0.
3. **Tipos**: ejecutar `npm run api:generate` desde `RACPD.Frontend`.
4. **Frontend — Checklist**: editar `ChecklistTareas.tsx` con `intentoEnviar` + borde rojo + mensaje.
5. **Frontend — Diálogo**: editar `DialogoCrearBloque.tsx` con microcopy `Semanas` + pasar `intentoEnviar`.
6. **Validación final**: `dotnet build` + `npm run build` → 0/0 en ambos.

---

> **Este spec-007 NO implementa código hasta segunda aprobación explícita del Tech Lead.** Cuando se apruebe, los pasos 1..6 se ejecutan en el orden indicado y se reportan resultados en una sola respuesta con enlaces `file:///` a los archivos modificados.