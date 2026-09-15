# SPEC-REFACTOR-EDITAR-BLOQUE — Eliminación del wrapper `EditarBloqueConId` y unificación del contrato PUT de bloques

> **Proyecto:** RACPD — Red de Apoyo para Cuidadores de Personas con Dependencia  
> **Feature:** 2. Agenda Compartida de Turnos — Refactor de Contratos  
> **Fecha:** 2026-09-10  
> **Alcance:** Estandarización del endpoint `PUT /api/agenda/{id}` para alinear su payload con el contrato plano de `POST /api/agenda`, eliminando el wrapper artificial `EditarBloqueConId` y los parches de adaptación en el cliente Orval.  
> **Tipo:** Refactor quirúrgico de contrato (sin cambios funcionales, sin migraciones, sin tocar reglas de negocio).

---

## 1. Contexto y Motivación

### 1.1 Estado actual (antipatrón detectado)

El endpoint `EditarBloqueEndpoint.cs` introduce un record contenedor artificial para "envolver" el cuerpo del request cuando la ruta incluye path params:

```csharp
public record EditarBloqueConId(EditarBloqueRequest Data);
```

Esto provoca tres problemas concretos verificables en el código actual:

| # | Problema | Evidencia |
|---|---|---|
| 1 | **Asimetría en la API** | `POST /api/agenda` recibe un payload plano (ver `AgendaDTOs.cs` → `CrearBloqueRequest`), mientras que `PUT /api/agenda/{id}` obliga a enviar `{ "data": { ... } }` (ver `EditarBloqueEndpoint.cs:51` → `var body = req.Data;`). |
| 2 | **Contrato OpenAPI contaminado** | El schema generado para `PUT /api/agenda/{id}` expone un envoltorio redundante (`data: { ... }`) que no aporta información semántica y solo añade ruido al spec Swagger. |
| 3 | **Parches en el cliente** | `useAgenda.ts:52` requiere `rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint(arg.id, { data: arg.data })` — un envoltorio manual que no existe en `useCrearBloque`. |

### 1.2 Estado deseado

El body de `PUT /api/agenda/{id}` debe ser **exactamente el mismo shape** que el body de `POST /api/agenda`. El identificador viaja **únicamente en la ruta** (path segment `{id}`); **no debe aparecer en el body**. FastEndpoints lo une automáticamente al campo `Id` del request DTO.

Esto es el comportamiento **nativo y soportado** de FastEndpoints: cuando el path template contiene `{id}` y el DTO expone una propiedad `Id` mutable (`{ get; set; }`) cuyo nombre coincida con el segment, el binding es automático, sin wrappers. **Importante:** el DTO debe ser una clase (o record no posicional) con propiedades de setter mutable. Los records posicionales generan propiedades `init`-only que **no son reasignables** tras la deserialización del body, por lo que el binding de ruta falla silenciosamente.

### 1.3 Fuera de alcance

- No se modifican reglas de negocio (validaciones de recurrencia, tareas, tenancy, reservas activas).
- No se cambian DTOs de respuesta (`EditarBloqueResponseDto` permanece igual).
- No se altera la ruta HTTP, ni el verbo, ni el rol requerido.
- No se introducen nuevos endpoints, helpers o abstracciones.
- No se renombran archivos.

---

## 2. Decisiones de Diseño

| # | Decisión | Justificación |
|---|---|---|
| 1 | Convertir `EditarBloqueRequest` de **record posicional** a **record/clase no posicional** con propiedades `{ get; set; }`, e incluir `Id` mutable como primera propiedad. | FastEndpoints reasigna las propiedades del DTO tras la deserialización del body para inyectar los path segments. Los setters `init`-only de los records posicionales **no son reasignables** post-construcción, por lo que el binding de ruta fallaría silenciosamente y `req.Id` quedaría en `Guid.Empty`. |
| 2 | Reemplazar `Endpoint<EditarBloqueConId, EditarBloqueResponseDto>` por `Endpoint<EditarBloqueRequest, EditarBloqueResponseDto>`. | Elimina la indirección; el request DTO es el mismo que se envía en `POST`. |
| 3 | Eliminar `Route<string>("id")` y el `Guid.TryParse` manual de la ruta. | El binding automático del framework garantiza el parseo y entrega el valor directamente en `req.Id`. La validación de `Guid.Empty` se hace dentro del bloque de negocio (ver decisión #5). |
| 4 | Usar `req` directamente en el cuerpo del handler (no más `req.Data`). | Tras la eliminación del wrapper, todos los accesos pasan a ser `req.Fecha`, `req.HoraInicio`, etc. — simétricos con `CrearBloqueEndpoint`. |
| 5 | Validar `req.Id == Guid.Empty` **dentro del bloque de negocio** del `HandleAsync`, junto al resto de validaciones manuales que ya existen. **No crear `EditarBloqueRequestValidator`.** | La feature `Agenda` no usa `Validator<T>` en ningún endpoint (a diferencia de, por ejemplo, `Identidad/InicioSesion`). Todas las validaciones se realizan manualmente y los errores se emiten vía `ProblemDetailsHelper.EnviarErroresValidacionAsync`. Crear un validator solo para `Id` haría que FastEndpoints respondiera con el serializador por defecto de FluentValidation, **rompiendo el formato uniforme RFC 7807** del slice. |
| 6 | En el hook `useEditarBloque`, **desestructurar `{ id, ...body }`** para separar el segmento de ruta del body, y pasar `body` (sin `id`) como segundo argumento a la función generada por Orval. | Si Orval expone `id` como path param y `EditarBloqueRequest` también lo contiene (por reusar el mismo shape), el binding de Orval esperará dos argumentos: `(id, body)`. Pasar `arg` completo en el segundo argumento enviaría `id` duplicado (ruta + body) y dispararía el `excess property check` de TypeScript. |
| 7 | Regenerar tipos TypeScript vía Orval **antes** de refactorizar el cliente. | Asegura que la nueva firma generada (sin envoltorio, con `id` mutable) sea la fuente de verdad. |

---

## 3. Cambios Backend (`RACPD.Backend`)

### 3.1 `RACPD.Backend/Features/Agenda/AgendaDTOs.cs`

**Modificación crítica:** convertir `EditarBloqueRequest` de **record posicional** a **record no posicional con propiedades `{ get; set; }`** e incluir `Id` mutable como primera propiedad.

> **Por qué no posicional:** los records posicionales generan propiedades `init`-only. FastEndpoints necesita **reasignar** las propiedades del DTO tras la deserialización del body para inyectar los path segments. Si el setter es `init`, la asignación falla y `req.Id` queda en `Guid.Empty` aunque la ruta tenga un GUID válido.

```csharp
/// <summary>
/// Request para editar un bloque de turno.
/// Definido como record NO posicional con setters mutables para que
/// FastEndpoints pueda inyectar el path segment <c>{id}</c> en la propiedad
/// <c>Id</c> tras la deserialización del body. Los records posicionales
/// generan setters <c>init</c>-only incompatibles con este binding.
/// </summary>
public record EditarBloqueRequest
{
    /// <summary>Identificador del bloque. Se bindea desde el path segment <c>{id}</c>.</summary>
    public Guid Id { get; set; }

    public string Fecha { get; set; } = default!;
    public string HoraInicio { get; set; } = default!;
    public string HoraFin { get; set; } = default!;
    public int CuposMaximos { get; set; }
    public string? Descripcion { get; set; }
    public Guid PerfilDependienteId { get; set; }
    public string TipoRecurrencia { get; set; } = "Unica";
    public int? IntervaloSemanas { get; set; }
    public List<TareaTurnoItemRequest>? Tareas { get; set; }
}
```

### 3.2 `RACPD.Backend/Features/Agenda/Editar/EditarBloqueEndpoint.cs`

**Modificaciones:**

1. Eliminar completamente el record al final del archivo:
   ```csharp
   /// Wrapper necesario porque FastEndpoints envía la request en req.Data
   /// cuando la ruta incluye path params.
   public record EditarBloqueConId(EditarBloqueRequest Data);
   ```
   Este bloque se borra sin reemplazo.

2. Cambiar la firma genérica del endpoint:
   ```csharp
   public class EditarBloqueEndpoint : Endpoint<EditarBloqueRequest, EditarBloqueResponseDto>
   ```

3. Cambiar la firma de `HandleAsync`:
   ```csharp
   public override async Task HandleAsync(EditarBloqueRequest req, CancellationToken ct)
   ```

4. **Eliminar** el bloque de parseo manual del id de ruta (líneas 42–49 actuales):
   ```csharp
   if (!Guid.TryParse(Route<string>("id"), out var bloqueId))
   {
       await ProblemDetailsHelper.EnviarErroresValidacionAsync(...);
       return;
   }
   ```
   Sustituir por: el `Id` viene en `req.Id` (bind automático). La validación de `Guid.Empty` se hace dentro del bloque de negocio (ver paso 6).

5. Sustituir `var body = req.Data;` por uso directo de `req` en todo el cuerpo del handler. Localmente puede mantenerse el alias `var body = req;` para minimizar el diff y mantener legibilidad simétrica con `CrearBloqueEndpoint`, pero `req.Data` deja de existir.

6. **Añadir la validación de `req.Id` dentro del diccionario `erroresNegocio`** (junto a las validaciones de `PerfilDependienteId`, `TipoRecurrencia`, etc.), conservando el formato RFC 7807 uniforme del slice:
   ```csharp
   var erroresNegocio = new Dictionary<string, IEnumerable<string>>();

   if (req.Id == Guid.Empty)
       erroresNegocio["id"] = ["El identificador del bloque es obligatorio."];

   if (body.PerfilDependienteId == Guid.Empty)
       erroresNegocio["perfilDependienteId"] = ["Debe seleccionar un dependiente válido."];
   ```
   El envío posterior del diccionario a `ProblemDetailsHelper.EnviarErroresValidacionAsync` se mantiene **idéntico** al flujo actual.

7. Sustituir toda referencia interna a `bloqueId` por `req.Id` en la consulta:
   ```csharp
   var bloque = await _dbContext.BloquesTurno
       .Include(b => b.Reservas.Where(r => r.Activa))
       .FirstOrDefaultAsync(b => b.Id == req.Id, ct);
   ```

> **No se crea ningún `Validator<T>`.** La feature `Agenda` mantiene su patrón actual: validación manual en `HandleAsync` + `ProblemDetailsHelper`. Migrar a FluentValidation sería un refactor global fuera del alcance de este spec.

---

## 4. Regeneración de Contratos (Orval)

### 4.1 Procedimiento exacto

Ejecutar **en este orden estricto**:

1. **Backend arriba:**
   ```powershell
   dotnet run --project RACPD.Backend
   ```
   Esperar a que Swagger esté expuesto (por defecto `https://localhost:7xxx/swagger/v1/swagger.json`).

2. **Generar tipos en frontend:**
   ```powershell
   cd RACPD.Frontend
   npm run api:generate
   ```
   Este script invoca Orval leyendo el `swagger.json` y escribiendo en `src/api/generated/`.

3. **Verificar el nuevo shape:** el archivo `src/api/generated/model/rACPDBackendFeaturesAgendaEditarBloqueRequest.ts` (o equivalente) ahora expone `id: string;` como primera propiedad, **sin envoltorio `data`**.

### 4.2 Criterio de éxito de la regeneración

- `src/api/generated/api/api.ts` (o su equivalente) declara una función `rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint(id, body)` donde:
  - `id: string` corresponde al **path segment**.
  - `body` tiene tipo directo `RACPDBackendFeaturesAgendaEditarBloqueRequest` (sin envoltorio `data`).
  - El body puede o no incluir `id` según cómo Orval resuelva el binding; el **frontend debe omitirlo** desestructurando `{ id, ...body }` (ver §5.1).
- No existen referencias huérfanas a `EditarBloqueConId` en el código generado.

---

## 5. Cambios Frontend (`RACPD.Frontend`)

### 5.1 `RACPD.Frontend/src/features/agenda/hooks/useAgenda.ts`

**Refactor del hook `useEditarBloque`:** eliminar el envoltorio `{ data: ... }` y **separar el path segment `id` del body** mediante desestructuración. Esto evita enviar `id` duplicado (ruta + body) y satisface el `excess property check` de TypeScript cuando Orval genera la firma `(id, body)`.

Antes:
```typescript
export const useEditarBloque = () => {
  return useSWRMutation(
    '/api/agenda',
    async (
      _: string,
      { arg }: { arg: { id: string; data: RACPDBackendFeaturesAgendaEditarBloqueRequest } }
    ) => {
      return rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint(arg.id, { data: arg.data });
    }
  );
};
```

Después:
```typescript
export const useEditarBloque = () => {
  return useSWRMutation(
    '/api/agenda',
    async (
      _: string,
      { arg }: { arg: RACPDBackendFeaturesAgendaEditarBloqueRequest }
    ) => {
      const { id, ...body } = arg;
      return rACPDBackendFeaturesAgendaEditarEditarBloqueEndpoint(id, body);
    }
  );
};
```

> Notas:
> - `RACPDBackendFeaturesAgendaEditarBloqueRequest` (regenerado por Orval) **sí incluye** `id: string;` como primera propiedad. El caller pasa el objeto completo con `id`; el hook lo **extrae** para la ruta y pasa el resto como body.
> - Si Orval genera un tipo separado `RACPDBackendFeaturesAgendaEditarBloqueBody` (sin `id`), ajustar la firma del hook a `{ arg: { id: string; body: RACPDBackendFeaturesAgendaEditarBloqueBody } }` y propagar. La inspección del archivo generado en §4.2 determina cuál de los dos shapes aplica.

### 5.2 `RACPD.Frontend/src/views/Agenda/AgendaDesktop.tsx`

**Llamada actual (línea ~128):**
```typescript
const respuesta = await editarBloque({
  id: bloqueEditando.id,
  data: {
    fecha: data.fecha,
    // ... resto de campos
  },
});
```

**Llamada refactorizada:**
```typescript
const respuesta = await editarBloque({
  id: bloqueEditando.id,
  fecha: data.fecha,
  horaInicio: data.horaInicio,
  horaFin: data.horaFin,
  cuposMaximos: data.cuposMaximos,
  descripcion: data.descripcion ?? null,
  perfilDependienteId: data.perfilDependienteId,
  tipoRecurrencia: data.tipoRecurrencia,
  intervaloSemanas: data.intervaloSemanas ?? null,
  tareas: (data.tareas ?? []).map((t) => ({
    id: t.id,
    descripcion: t.descripcion,
    orden: t.orden,
  })),
});
```

Se elimina la clave `data:` exterior y todos los campos quedan al mismo nivel.

### 5.3 `RACPD.Frontend/src/views/Agenda/AgendaMobile.tsx`

**Refactor idéntico al de `AgendaDesktop.tsx`** (líneas ~131–148). Mismo shape plano, mismo contrato.

### 5.4 Verificación de tipos

Tras el refactor, no debe existir:
- Ningún `as any` introducido para silenciar el tipado (los actuales `as any` en ambas vistas se eliminan al alinear el contrato).
- Ningún `{ data: ... }` envolviendo llamadas a `editarBloque`.

---

## 6. Criterios de Aceptación

### 6.1 Backend

- [ ] El record `EditarBloqueConId` **no existe** en el código (búsqueda con `Grep "EditarBloqueConId"` retorna cero resultados).
- [ ] `EditarBloqueRequest` declara `Guid Id` como primera propiedad.
- [ ] `EditarBloqueEndpoint` extiende `Endpoint<EditarBloqueRequest, EditarBloqueResponseDto>`.
- [ ] `HandleAsync(EditarBloqueRequest req, ...)` no accede a `req.Data`.
- [ ] No existe `Route<string>("id")` en el endpoint (el binding es automático).
- [ ] No existe ningún `EditarBloqueRequestValidator` (la validación de `Id` está dentro de `HandleAsync`).
- [ ] La validación `req.Id == Guid.Empty` está integrada en `erroresNegocio` y emite error RFC 7807 vía `ProblemDetailsHelper`.
- [ ] `dotnet build` finaliza con código 0 sin warnings nuevos.

### 6.2 OpenAPI / Swagger

- [ ] En `swagger.json`, la operación `PUT /api/agenda/{id}` declara el body como el schema directo de `EditarBloqueRequest` (con `id` en path, no en body).
- [ ] El spec no contiene ningún schema `EditarBloqueConId`.
- [ ] El payload de ejemplo enviado a `PUT /api/agenda/{id}` es (notar que **`id` NO está en el body**, va solo en la ruta):
    ```json
    {
      "fecha": "2026-09-10",
      "horaInicio": "08:00",
      "horaFin": "12:00",
      "cuposMaximos": 2,
      "descripcion": null,
      "perfilDependienteId": "…",
      "tipoRecurrencia": "Unica",
      "intervaloSemanas": null,
      "tareas": []
    }
    ```
    Sin clave `data` envolvente y sin clave `id` (el identificador viaja en la URL).

### 6.3 Frontend

- [ ] `Grep "{ data: arg.data }"` sobre `src/` retorna cero resultados.
- [ ] `useEditarBloque` recibe `arg: RACPDBackendFeaturesAgendaEditarBloqueRequest` (sin envoltura) y desestructura `const { id, ...body } = arg;` antes de invocar a Orval.
- [ ] Las llamadas en `AgendaDesktop.tsx` y `AgendaMobile.tsx` pasan el objeto plano.
- [ ] No hay `as any` nuevo introducido para silenciar errores de tipo.
- [ ] `npx tsc --noEmit` finaliza con código 0.
- [ ] `npm run build` finaliza con código 0.

### 6.4 Runtime (verificación manual opcional)

- [ ] `POST /api/agenda` (crear) sigue funcionando idéntico.
- [ ] `PUT /api/agenda/{id}` con payload plano responde 200 y aplica cambios.
- [ ] `PUT /api/agenda/{id}` con `id` vacío en la ruta (UUID zero) responde 400 RFC 7807 desde `ProblemDetailsHelper`.

---

## 7. Plan de Verificación (orden de ejecución)

| Paso | Comando | Resultado esperado |
|---|---|---|
| 1 | `cd RACPD.Backend && dotnet build` | Compila sin errores. |
| 2 | Backend corriendo + `Invoke-RestMethod https://localhost:<port>/swagger/v1/swagger.json` (o inspección manual del endpoint) | El schema del PUT no contiene `EditarBloqueConId`. |
| 3 | `cd RACPD.Frontend && npm run api:generate` | Tipos regenerados sin error. |
| 4 | `cd RACPD.Frontend && npx tsc --noEmit` | Cero errores de tipo. |
| 5 | `cd RACPD.Frontend && npm run build` | Build de producción exitoso. |
| 6 | `Grep -r "EditarBloqueConId"` sobre el repo | Cero coincidencias. |
| 7 | `Grep -r "{ data: arg.data }"` sobre `src/` | Cero coincidencias. |
| 8 | Smoke test E2E del flujo "editar bloque" en UI | El bloque se actualiza y la lista refleja el cambio. |

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Orval genera tipos con un shape distinto al esperado (ej. `id` opcional) | Baja | Inspeccionar el archivo generado antes de tocar el cliente; si `id` no aparece en el request DTO, revertir y revisar `orval.config.*` (debería usar `useDeprecatedOperations: false`). |
| Otro consumidor del endpoint (no detectado) sigue enviando `{ data: ... }` | Baja | Confirmar con `Grep "EditarBloque"` en todo el repo; este refactor es interno y solo afecta a `RACPD.Frontend`. |
| El binding automático de `Id` no se activa en el runtime de FastEndpoints | Muy baja | FastEndpoints 5.x+ bindea cualquier propiedad del DTO con setter mutable (`{ get; set; }`) cuyo nombre coincida con un path segment. Si fallara, fallback inmediato: declarar explícitamente `Route Param` vía atributo `[BindFrom("id")] public Guid Id { get; set; }` en `EditarBloqueRequest` — pero no se anticipa necesario. |

---

## 9. Entregables

1. `RACPD.Backend/Features/Agenda/AgendaDTOs.cs` — `EditarBloqueRequest` con `Id` añadido.
2. `RACPD.Backend/Features/Agenda/Editar/EditarBloqueEndpoint.cs` — firma genérica cambiada, wrapper eliminado, handler actualizado.
3. *(Eliminado)* No se crea `EditarBloqueRequestValidator.cs`. La validación de `Id` se hace dentro de `HandleAsync` en el mismo `erroresNegocio` que el resto de validaciones.
4. `RACPD.Frontend/src/api/generated/**` — regenerado por Orval.
5. `RACPD.Frontend/src/features/agenda/hooks/useAgenda.ts` — `useEditarBloque` sin envoltorio.
6. `RACPD.Frontend/src/views/Agenda/AgendaDesktop.tsx` — llamada plana.
7. `RACPD.Frontend/src/views/Agenda/AgendaMobile.tsx` — llamada plana.

---

## 10. No-Objetivos (explícitos)

- No se añade `BindFrom` ni atributos extra si el binding automático funciona.
- No se cambian DTOs de respuesta.
- No se introduce ningún `Validator<T>` nuevo. La feature `Agenda` mantiene su patrón de validación manual + `ProblemDetailsHelper`. Migrar la suite completa a FluentValidation queda fuera de alcance.
- No se introduce lógica de "extraer id del body" en backend (el id solo viaja en la ruta).
- No se introducen nuevos tests automáticos (este refactor no cambia comportamiento observable más allá del shape del payload).
- No se documenta Swagger con descripciones nuevas.
- No se modifica el README ni ningún archivo fuera de los listados en §9.
