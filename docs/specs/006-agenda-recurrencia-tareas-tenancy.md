# SPEC.md — Persona 1 / Semana 1: Recurrencia, Tareas y Tenancy de Bloques de Turno

> **Proyecto:** RACPD — Red de Apoyo para Cuidadores de Personas con Dependencia  
> **Feature:** 2. Agenda Compartida de Turnos — Iteración 2 (Semana 1, Persona 1)  
> **Fecha:** 2026-09-10  
> **Alcance:** Infraestructura de base de datos (PostgreSQL/EF Core), contratos de API (FastEndpoints), seguridad de aislamiento clínico (Data Tenancy por Cuidador Principal) y componentes de UI con validación Zod (`DialogoCrearBloque.tsx`, `TarjetaBloque.tsx`).

---

## 1. Contexto y Objetivos

La iteración inicial de la agenda desacopló erróneamente los turnos del sujeto de cuidado. En RACPD, todo evento operativo debe estar vinculado de forma estricta a un dependiente clínico y gobernado por un Cuidador Principal.

Esta entrega cubre cuatro ejes:
1. **Tenancy Clínico Estricto:** Cada bloque se asocia obligatoriamente a un `PerfilDependiente`. Solo cuidadores con rol `CuidadorPrincipal` y vínculo activo pueden crear o modificar turnos.
2. **Recurrencia Operativa:** Soporte para turnos únicos, indefinidos o con periodicidad de 1 a 24 semanas.
3. **Checklist de Tareas en Bloque:** Gestión de actividades dentro del turno mediante serialización nativa JSON en PostgreSQL.
4. **Selector Dinámico y UI:** Formulario unificado (`DialogoCrearBloque.tsx`) con búsqueda difusa (Fuse.js) y checklist interactivo.

> **Fuera de alcance (Semana 2):** El algoritmo de proyección de repeticiones en el endpoint de consulta del calendario (`GET /api/agenda`). En esta fase solo se establecen la persistencia, los contratos y la interfaz de captura.

---

## 2. Decisiones de Arquitectura y Dominio

| # | Decisión | Implementación Técnica |
|---|---|---|
| 1 | Nomenclatura del Enum de Recurrencia | `TipoRecurrencia` con valores: `Unica`, `Indefinida`, `Semanas`. |
| 2 | Campo Legacy `EsRecurrente` | Eliminado del modelo y reemplazado en su totalidad por `TipoRecurrencia`. |
| 3 | Persistencia de Colección de Tareas | EF Core nativo: `entity.OwnsMany(e => e.Tareas, b => b.ToJson());`. Sin ValueComparers manuales. |
| 4 | Estrategia de Migración `PerfilDependienteId` | **Migración en 2 Pasos**: 1. Columna `Guid?` nullable; 2. Poblado de datos con MCP Supabase / script; 3. Migración a `Guid` NOT NULL con FK `Restrict`. |
| 5 | Aislamiento y Control de Acceso (BOLA/IDOR) | Validación en Handler: Vínculo activo en `VinculosDependientes` con `Rol == CuidadorPrincipal`. Respuesta `403 Forbidden` RFC 7807 si no cumple. |
| 6 | Componente de Formulario | `DialogoCrearBloque.tsx` unificado para creación y edición (`modo: 'crear' | 'editar'`). |

---

## 3. Modelo de Dominio (.NET)

### 3.1 Entidad `BloqueTurno`

```csharp
namespace RACPD.Backend.Domain.Entities;

public class BloqueTurno
{
    public Guid Id { get; set; }
    public DateOnly Fecha { get; set; }                    // YYYY-MM-DD (America/Guayaquil)
    public TimeOnly HoraInicio { get; set; }               // HH:mm
    public TimeOnly HoraFin { get; set; }                  // HH:mm
    public int CuposMaximos { get; set; } = 1;             // Rango: 1..5

    // === Persona 1 / Semana 1 ===
    public Guid PerfilDependienteId { get; set; }          // FK obligatoria -> PerfilDependiente
    public TipoRecurrencia TipoRecurrencia { get; set; } = TipoRecurrencia.Unica;
    public int? IntervaloSemanas { get; set; }             // Rango: 1..24 (solo cuando TipoRecurrencia == Semanas)
    public List<TareaTurnoItem> Tareas { get; set; } = []; // Mapeado a jsonb nativo

    public string? Descripcion { get; set; }
    public Guid CreadoPorId { get; set; }
    public DateTimeOffset FechaCreacion { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FechaModificacion { get; set; }

    // Navegación
    public PerfilDependiente PerfilDependiente { get; set; } = null!;
    public Usuario CreadoPor { get; set; } = null!;
    public ICollection<ReservaTurno> Reservas { get; set; } = new List<ReservaTurno>();
}

```

### 3.2 Enum `TipoRecurrencia`

```csharp
namespace RACPD.Backend.Domain.Enums;

public enum TipoRecurrencia
{
    Unica = 0,
    Indefinida = 1,
    Semanas = 2
}

```

### 3.3 Value Object `TareaTurnoItem`

```csharp
namespace RACPD.Backend.Domain.Entities;

public record TareaTurnoItem(Guid Id, string Descripcion, int Orden);

```

---

## 4. Persistencia y Migraciones EF Core

### 4.1 Configuración en `AppDbContext.cs`

```csharp
modelBuilder.Entity<BloqueTurno>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Descripcion).HasMaxLength(200);

    // Enum persistido como string para legibilidad y consistencia
    entity.Property(e => e.TipoRecurrencia).HasConversion<string>();

    // Mapeo JSON nativo de EF Core (PostgreSQL jsonb)
    entity.OwnsMany(e => e.Tareas, builder =>
    {
        builder.ToJson();
    });

    // Relación obligatoria con PerfilDependiente
    entity.HasOne(e => e.PerfilDependiente)
        .WithMany()
        .HasForeignKey(e => e.PerfilDependienteId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasOne(e => e.CreadoPor)
        .WithMany()
        .HasForeignKey(e => e.CreadoPorId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasIndex(e => e.Fecha);
    entity.HasIndex(e => e.PerfilDependienteId);
});

```

### 4.2 Proceso de Migración Segura (2 Fases)

1. **Fase A (Paso temporal nullable):**
* Configurar `PerfilDependienteId` como `Guid?` provisional en la entidad.
* Ejecutar: `dotnet ef migrations add AgregarRecurrenciaYTareasBloqueTurno --project RACPD.Backend`.
* Aplicar migración: `dotnet ef database update`.


2. **Fase B (Auditoría y Poblado de Datos):**
* Usar el MCP de Supabase para inspeccionar la tabla `BloquesTurno`.
* Si existen registros legacy de prueba, asociarlos a un `PerfilDependiente` activo existente en la base de datos o truncar los turnos de prueba obsoletos.


3. **Fase C (Consolidación NOT NULL):**
* Cambiar `PerfilDependienteId` a `Guid` no nullable.
* Ejecutar: `dotnet ef migrations add HacerPerfilDependienteIdObligatorio --project RACPD.Backend`.
* Aplicar migración y verificar `AppDbContextModelSnapshot.cs`.



---

## 5. Endpoints Backend (FastEndpoints)

### 5.1 DTOs de Contrato (`AgendaDTOs.cs`)

```csharp
public record CrearBloqueRequest(
    string Fecha,                     // YYYY-MM-DD
    string HoraInicio,                // HH:mm
    string HoraFin,                   // HH:mm
    int CuposMaximos = 1,
    string? Descripcion = null,
    Guid PerfilDependienteId = default!,
    string TipoRecurrencia = "Unica",
    int? IntervaloSemanas = null,
    List<TareaTurnoItemRequest>? Tareas = null
);

public record EditarBloqueRequest(
    Guid Id,
    string Fecha,
    string HoraInicio,
    string HoraFin,
    int CuposMaximos,
    string? Descripcion,
    Guid PerfilDependienteId,
    string TipoRecurrencia,
    int? IntervaloSemanas,
    List<TareaTurnoItemRequest>? Tareas
);

public record TareaTurnoItemRequest(Guid? Id, string Descripcion, int Orden);

public record BloqueTurnoDto(
    Guid Id,
    string Fecha,
    string HoraInicio,
    string HoraFin,
    int CuposMaximos,
    int CuposDisponibles,
    string? Descripcion,
    UsuarioResumenDto CreadoPor,
    IReadOnlyList<ReservaTurnoDto> Reservas,
    bool PuedoReservar,
    bool YaReserve,
    Guid PerfilDependienteId,
    string NombreDependiente,
    string TipoRecurrencia,
    int? IntervaloSemanas,
    IReadOnlyList<TareaTurnoDto> Tareas
);

public record TareaTurnoDto(Guid Id, string Descripcion, int Orden);

```

### 5.2 Lógica de Autorización y Tenancy (`CrearBloqueEndpoint.cs` / `EditarBloqueEndpoint.cs`)

El Cuidador Principal debe tener un vínculo explícito y activo sobre el dependiente asignado:

```csharp
var usuarioId = User.GetUsuarioId(); // Extensión de ClaimsPrincipal del proyecto

var tienePermiso = await _dbContext.VinculosDependientes
    .AsNoTracking()
    .AnyAsync(v =>
        v.UsuarioId == usuarioId &&
        v.PerfilDependienteId == req.PerfilDependienteId &&
        v.Activo &&
        v.Rol == RolEnDependiente.CuidadorPrincipal &&
        v.PerfilDependiente.Activo,
        ct);

if (!tienePermiso)
{
    await ProblemDetailsHelper.EnviarProhibidoAsync(
        HttpContext,
        "No tienes permisos de Cuidador Principal sobre este dependiente.",
        tipoProhibido: "dependiente-no-autorizado");
    return;
}

```

### 5.3 Validaciones de Dominio (FluentValidation)

* `PerfilDependienteId`: Obligatorio y distinto de `Guid.Empty`.
* `TipoRecurrencia`: Debe pertenecer a `["Unica", "Indefinida", "Semanas"]`.
* `IntervaloSemanas`:
* Si `TipoRecurrencia == "Semanas"`, debe ser un entero entre 1 y 24.
* Si `TipoRecurrencia != "Semanas"`, debe ser nulo.


* `Tareas`:
* Máximo 20 tareas por bloque.
* Cada tarea debe tener `Descripcion` con longitud entre 1 y 200 caracteres y `Orden >= 0`.



---

## 6. Frontend (React 19, Zod, Tailwind)

### 6.1 Esquema de Validación (`views/Agenda/schema.ts`)

```typescript
import { z } from 'zod';

export const tareaSchema = z.object({
  id: z.string().uuid().optional(),
  descripcion: z.string().trim().min(1, 'La tarea no puede estar vacía').max(200, 'Máximo 200 caracteres'),
  orden: z.number().int().min(0).max(99),
});

export const tipoRecurrenciaEnum = z.enum(['Unica', 'Indefinida', 'Semanas']);

export const bloqueFormSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido'),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:mm inválido'),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:mm inválido'),
  cuposMaximos: z.number().int().min(1).max(5),
  descripcion: z.string().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
  perfilDependienteId: z.string().uuid('Debe seleccionar un dependiente'),
  tipoRecurrencia: tipoRecurrenciaEnum,
  intervaloSemanas: z.number().int().min(1).max(24).optional(),
  tareas: z.array(tareaSchema).max(20, 'Máximo 20 tareas permitidas').default([]),
}).superRefine((val, ctx) => {
  if (val.tipoRecurrencia === 'Semanas' && (!val.intervaloSemanas || val.intervaloSemanas < 1 || val.intervaloSemanas > 24)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Debe especificar un intervalo entre 1 y 24 semanas',
      path: ['intervaloSemanas'],
    });
  }
  if (val.tipoRecurrencia !== 'Semanas' && val.intervaloSemanas !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El intervalo solo aplica para recurrencia semanal',
      path: ['intervaloSemanas'],
    });
  }
  if (val.horaInicio && val.horaFin && val.horaFin <= val.horaInicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La hora de fin debe ser posterior a la hora de inicio',
      path: ['horaFin'],
    });
  }
});

export type BloqueFormData = z.infer<typeof bloqueFormSchema>;

```

### 6.2 Componente `DialogoCrearBloque.tsx`

Soporta `modo: 'crear' | 'editar'`. Estructura del modal:

1. **Selector de Dependientes:** Consume `useRACPDBackendFeaturesPerfilesDependientesListarMisDependientesListarMisDependientesEndpoint`. Filtra exclusivamente dependientes con rol `CuidadorPrincipal`. Utiliza `fuse.js` para búsqueda difusa rápida idéntica a la vista de accesos.
2. **Fecha y Horarios:** Selectores accesibles con validación nativa de rango.
3. **Cupos Disponibles:** Selector numérico de 1 a 5.
4. **Recurrencia Dinámica:**
* Select con opciones: "Una sola vez" (`Unica`), "Indefinida" (`Indefinida`) y "Cada N semanas" (`Semanas`).
* Al elegir `Semanas`, se monta el input numérico para `intervaloSemanas` con límites `min={1}` y `max={24}`.


5. **Componente `ChecklistTareas.tsx`:**
* Input para redactar nueva tarea con commit por tecla `Enter` o click en botón `+`.
* Lista visual de tareas ordenadas con botón individual de eliminación y drag/reordenamiento básico.



### 6.3 Actualización de `TarjetaBloque.tsx`

* Badge superior que muestre el dependiente asignado: `bloque.nombreDependiente`.
* Badge de recurrencia si `bloque.tipoRecurrencia !== 'Unica'`:
* Si es `Indefinida`: badge `Indefinido`.
* Si es `Semanas`: badge `Cada {intervaloSemanas} sem.`.


* Indicador de tareas: badge que refleje `bloque.tareas.length` tareas asociadas.

---

## 7. Regeneración de Clientes y Flujo SWR

1. Aplicar migraciones y compilar backend (`dotnet build`).
2. Levantar API y ejecutar regeneración de contratos Orval:
```bash
npm run api:generate

```


3. Comprobar que `useAgenda` y los endpoints generados tipen correctamente los nuevos campos en `RACPD.Frontend`.
4. En mutaciones (`crearBloque`, `editarBloque`), disparar `mutate()` sobre la clave SWR de agenda para refresco en pantalla.

---

## 8. Verificación de Cierre

* [ ] `dotnet build` compila con 0 errores y 0 warnings.
* [ ] Migraciones aplicadas correctamente y validadas en Supabase (primera nullable, poblado ejecutado, segunda NOT NULL).
* [ ] Intentar crear un bloque con un `perfilDependienteId` donde el usuario autenticado solo sea `Apoyo` devuelve `403 Forbidden`.
* [ ] Enviar `tipoRecurrencia: "Semanas"` sin `intervaloSemanas` responde `400 Bad Request` RFC 7807.
* [ ] Colección `Tareas` se almacena como JSON válido en la columna `Tareas` de PostgreSQL.
* [ ] `npm run build` en el frontend finaliza con éxito.
* [ ] Selector con Fuse.js filtra dependientes en memoria solo sobre la lista autorizada del usuario.
* [ ] Creación y edición persisten correctamente tareas y tipo de recurrencia en base de datos.