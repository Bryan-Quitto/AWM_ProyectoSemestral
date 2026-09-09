# SPEC.md — Agenda Compartida de Turnos

> **Proyecto:** RACPD — Red de Apoyo para Cuidadores de Personas con Dependencia  
> **Feature:** 2. Agenda Compartida de Turnos  
> **Fecha:** 2024-09-05  
> **Autores:** Elite Senior Software Architect & Tech Lead  
> **Versión:** 1.0.0

---

## 1. Modelo de Datos

### 1.1 Entidades

```csharp
// Entidad: Bloque de Turno
public class BloqueTurno
{
    public Guid Id { get; set; }
    public DateOnly Fecha { get; set; }                    // YYYY-MM-DD (Ecuador)
    public TimeOnly HoraInicio { get; set; }                // HH:mm (Ecuador)
    public TimeOnly HoraFin { get; set; }                   // HH:mm
    public int CuposMaximos { get; set; }                   // Default: 1, Min: 1, Max: 5
    public string? Descripcion { get; set; }                // Opcional, ej: "Turno de noche"
    public bool EsRecurrente { get; set; }                  // Por implementar v2
    public Guid CreadoPorId { get; set; }                   // FK → Usuario (CuidadorPrincipal)
    public DateTimeOffset FechaCreacion { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FechaModificacion { get; set; }
    public byte[] Version { get; set; }                     // Concurrency Token
    
    // Navegación
    public Usuario CreadoPor { get; set; } = null!;
    public ICollection<ReservaTurno> Reservas { get; set; } = new List<ReservaTurno>();
}

// Entidad: Reserva de Turno
public class ReservaTurno
{
    public Guid Id { get; set; }
    public Guid BloqueTurnoId { get; set; }                 // FK → BloqueTurno
    public Guid UsuarioId { get; set; }                     // FK → Usuario (Apoyo o Principal)
    public DateTimeOffset FechaReserva { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FechaCancelacion { get; set; }
    public bool Activa { get; set; } = true;                // Soft delete
    
    // Navegación
    public BloqueTurno BloqueTurno { get; set; } = null!;
    public Usuario Usuario { get; set; } = null!;
}
```

### 1.2 Enums

```csharp
public enum FiltroAgenda
{
    Todos,
    MisBloques,       // Solo los que creé (Principal)
    MisReservas,      // Solo los que reservé (Apoyo)
    Disponibles       // Bloques con cupos libres
}

public enum VistaCalendario
{
    Mes,
    Semana,
    Dia
}
```

### 1.3 Reglas de Negocio

| # | Regla | Justificación |
|---|-------|---------------|
| R1 | Solo `CuidadorPrincipal` puede crear/editar/eliminar bloques | Control centralizado del cuidado |
| R2 | Un usuario NO puede reservar su propio bloque | Prevención de auto-asignación |
| R3 | No reservar en bloques pasados | Integridad histórica |
| R4 | Cupos máximos: 1-5 por bloque | Escalabilidad futura |
| R5 | Un usuario NO puede reservar 2 veces el mismo bloque | Integridad de datos |
| R6 | Un bloque con cupos llenos no permite más reservas | Control de capacidad |

---

## 2. Backend — FastEndpoints

### 2.1 Estructura de Carpetas

```
Features/
└── Agenda/
    ├── Listar/
    │   └── ListarBloquesEndpoint.cs       // GET /api/agenda
    ├── Obtener/
    │   └── ObtenerBloqueEndpoint.cs      // GET /api/agenda/{id}
    ├── Crear/
    │   └── CrearBloqueEndpoint.cs         // POST /api/agenda
    ├── Editar/
    │   └── EditarBloqueEndpoint.cs        // PUT /api/agenda/{id}
    ├── Eliminar/
    │   └── EliminarBloqueEndpoint.cs      // DELETE /api/agenda/{id}
    └── Reservas/
        ├── ReservarEndpoint.cs           // POST /api/agenda/{id}/reservar
        └── CancelarReservaEndpoint.cs    // DELETE /api/agenda/{id}/reserva
```

### 2.2 Endpoints

#### GET /api/agenda — Listar Bloques

**Request:**
```
Query Parameters:
  - fechaDesde?: DateOnly (default: hoy)
  - fechaHasta?: DateOnly (default: hoy + 30 días)
  - filtro?: FiltroAgenda (default: Todos)
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "fecha": "2024-09-10",
      "horaInicio": "08:00",
      "horaFin": "14:00",
      "cuposMaximos": 2,
      "cuposDisponibles": 1,
      "descripcion": "Turno matutino",
      "creadoPor": {
        "id": "uuid",
        "nombreCompleto": "María García"
      },
      "reservas": [
        {
          "id": "uuid",
          "usuario": {
            "id": "uuid",
            "nombreCompleto": "Juan Pérez"
          },
          "esMiReserva": true
        }
      ],
      "puedoReservar": true,
      "yaReservé": false
    }
  ]
}
```

**Autorización:**
| Rol | Acceso |
|-----|--------|
| CuidadorPrincipal | Listar todos + MisBloques + Disponibles |
| Apoyo | Listar todos + MisReservas + Disponibles |
| AdministradorSistema | ~~Listar todos~~ **DEPRECATED 2026-09**: el rol AdministradorSistema NO tiene actualmente capacidad funcional en la agenda desde la UI (no puede crear/editar/eliminar bloques ni reservar), por lo que mantenerle acceso de solo lectura generaba "acceso vacío" sin valor. Se removió del diccionario `POLITICAS_RUTAS` del Frontend y de los endpoints de Backend que tenían bypass de ownership (`EliminarBloque`, `CancelarReserva`). Coherente con el principio de menor privilegio. Si en el futuro se requiere moderación admin (anti-abuso, recuperación de turnos huérfanos), exponer acción explícita en UI + actualizar este spec. |

#### POST /api/agenda — Crear Bloque

**Request:**
```json
{
  "fecha": "2024-09-10",
  "horaInicio": "08:00",
  "horaFin": "14:00",
  "cuposMaximos": 2,
  "descripcion": "Turno matutino"
}
```

**Validaciones Zod:**
```csharp
// equivalent in C#
public record CrearBloqueRequest(
    [Required] DateOnly Fecha,
    [Required] TimeOnly HoraInicio,
    [Required] TimeOnly HoraFin,
    [Range(1, 5)] int CuposMaximos = 1,
    [MaxLength(200)] string? Descripcion = null
);
// + Validación: HoraFin > HoraInicio
// + Validación: Fecha >= hoy
```

**Autorización:** Solo `CuidadorPrincipal`

#### PUT /api/agenda/{id} — Editar Bloque

**Autorización:** Solo `CuidadorPrincipal` + debe ser el creador

#### DELETE /api/agenda/{id} — Eliminar Bloque

**Reglas:**
- Si hay reservas activas → 400 Bad Request con mensaje
- Solo creador o Administrador pueden eliminar

#### POST /api/agenda/{id}/reservar — Reservar Turno

**Reglas de negocio verificables:**
- R2: No reservar propio bloque
- R3: No bloques pasados
- R5: No doble reserva
- R6: Cupos disponibles

**Response 201:**
```json
{
  "data": {
    "reservaId": "uuid",
    "bloqueId": "uuid",
    "confirmadoEn": "2024-09-05T10:30:00-05:00"
  }
}
```

#### DELETE /api/agenda/{id}/reserva — Cancelar Reserva

**Autorización:** Solo el usuario que reservó o Administrador

---

## 3. Frontend — React + TanStack Router

### 3.1 Estructura de Archivos

```
src/
├── routes/_protegidas/agenda.tsx          # Route wrapper (DualView)
├── views/
│   └── Agenda/
│       ├── AgendaContenedor.tsx            # Lógica compartida
│       ├── AgendaDesktop.tsx               # Vista calendario mensual
│       ├── AgendaMobile.tsx                # Vista lista semanal
│       ├── DialogoCrearBloque.tsx          # Modal crear/editar
│       ├── TarjetaBloque.tsx               # Componente átomico
│       └── Schema.ts                       # Zod schemas
├── api/generated/                          # Orval (regenerar post-backend)
└── features/agenda/
    ├── hooks/
    │   ├── useAgenda.ts                    # SWR para listar
    │   └── useReservarTurno.ts             # Mutation hook
    └── types.ts                            # Tipos específicos
```

### 3.2 Zod Schemas

```typescript
import { z } from 'zod';

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const crearBloqueSchema = z.object({
  fecha: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (YYYY-MM-DD)')
    .refine(d => {
      const hoy = new Date().toISOString().split('T')[0];
      return d >= hoy;
    }, 'No se pueden crear bloques en fechas pasadas'),
  horaInicio: z.string().regex(horaRegex, 'Formato HH:mm'),
  horaFin: z.string().regex(horaRegex, 'Formato HH:mm'),
  cuposMaximos: z.number().min(1).max(5).default(1),
  descripcion: z.string().max(200).optional(),
}).refine(
  data => {
    const [hiH, hiM] = data.horaInicio.split(':').map(Number);
    const [hfH, hfM] = data.horaFin.split(':').map(Number);
    return (hiH * 60 + hiM) < (hfH * 60 + hfM);
  },
  { message: 'La hora de fin debe ser posterior a la de inicio', path: ['horaFin'] }
);

export type CrearBloqueFormData = z.infer<typeof crearBloqueSchema>;
```

### 3.3 Componentes UI

#### TarjetaBloque.tsx (átomico)

```tsx
type TarjetaBloqueProps = {
  bloque: BloqueDTO;
  onReservar?: (id: string) => void;
  onCancelar?: (id: string) => void;
  onEditar?: (bloque: BloqueDTO) => void; // Solo Principal
  onEliminar?: (id: string) => void;       // Solo Principal
  esMiBloque: boolean;
  esMiReserva: boolean;
  puedeReservar: boolean;
};

export const TarjetaBloque = ({ bloque, ... }: TarjetaBloqueProps) => {
  const estadoColor = useMemo(() => {
    if (bloque.cuposDisponibles === 0) return 'bg-gray-100 border-gray-300';
    if (esMiReserva) return 'bg-blue-50 border-blue-400';
    if (esMiBloque) return 'bg-green-50 border-green-400';
    return 'bg-white border-blue-200';
  }, [bloque, esMiReserva, esMiBloque]);

  return (
    <div 
      className={`p-4 rounded-lg border-2 transition-all cursor-pointer
        hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
        ${estadoColor} ${!puedeReservar && !esMiReserva ? 'opacity-75' : ''}
        ${!puedeReservar && !esMiReserva ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => puedeReservar && onReservar?.(bloque.id)}
    >
      {/* Contenido */}
    </div>
  );
};
```

### 3.4 Microinteracciones UX (Obligatorias)

| Elemento | Estados | Implementación |
|----------|---------|----------------|
| Botón Reservar | default, hover, loading, disabled | `cursor-pointer` → `cursor-not-allowed opacity-50` |
| Tarjeta Bloque | disponible, reservado, lleno | Feedback visual inmediato |
| Toast Confirmación | éxito, error | Auto-dismiss 3s |
| Loading | skeleton | Spinner azul alineado |

### 3.5 Dual View Strategy

**Mobile (< 768px):**
- Vista lista/semana (scroll vertical)
- Cards apiladas por día
- FAB para crear bloque (Principal)

**Desktop (≥ 768px):**
- Calendario mensual (grid 7x5)
- Hover en día → tooltip con bloques
- Click en día → drawer lateral con bloques

---

## 4. Testing Strategy

### 4.1 Backend

```bash
dotnet test --filter "FullyQualifiedName~Agenda"
```

**Casos de prueba mínimos:**

| Test | Descripción |
|------|-------------|
| `CrearBloque_CuidadorPrincipal_Exito` | Principal crea bloque válido |
| `CrearBloque_Apoyo_Rechazado` | Apoyo recibe 403 |
| `Reservar_CupoDisponible_Exito` | Reserva exitosa |
| `Reservar_CupoLleno_Rechazado` | 400 Cupos agotados |
| `Reservar_BloquePasado_Rechazado` | 400 Fecha inválida |
| `CancelarReserva_NoEsDueño_Rechazado` | 403 |

### 4.2 Frontend

```bash
npm test -- --coverage --testPathPattern="agenda"
```

**覆盖率 objetivo:** ≥ 80% branches

---

## 5. Checklist de Implementación

- [ ] Entidades `BloqueTurno` y `ReservaTurno` en Domain
- [ ] DbContext actualizado con nuevas tablas
- [ ] Migration EF Core
- [ ] 6 endpoints FastEndpoints
- [ ] Validaciones RFC 7807
- [ ] Autorización por rol
- [ ] Regenerar tipos Orval (`npm run api:generate`)
- [ ] Schema Zod
- [ ] `AgendaDesktop.tsx` (calendario mensual)
- [ ] `AgendaMobile.tsx` (lista semanal)
- [ ] `DialogoCrearBloque.tsx` (modal)
- [ ] `TarjetaBloque.tsx` (átomico)
- [ ] Hooks SWR (`useAgenda`, `useReservarTurno`)
- [ ] Microinteracciones (cursor, disabled states)
- [ ] Toast notifications
- [ ] Tests unitarios Backend
- [ ] Tests unitarios Frontend

---

## 6. Notas de Despliegue

1. **Migration:** `dotnet ef migrations add AddAgendaTables`
2. **Orval:** `npm run api:generate` (backend corriendo en puerto 5000)
3. **Environment:** No se requieren variables nuevas
4. **CORS:** Ya configurado para localhost:3000

---

*Documento aprobado para implementación. Fecha: _______*
