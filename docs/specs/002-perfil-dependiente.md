# FASE 4: Especificación Técnica - Perfil Dependiente y Agenda Base (RACPD)

## 1. Modelo de Datos (EF Core)
Bajo la regla de "Cero Indulgencia", estructuramos el modelo para Postgres utilizando tipos nativos, concurrencia por `xmin` y JSONB para los contactos de emergencia, evitando tablas innecesarias para colecciones pequeñas.

### 1.1 Entidades y Tablas

#### `PerfilDependiente` (Tabla principal)
```csharp
public class PerfilDependiente
{
    public Guid Id { get; init; } = Guid.NewGuid();
    
    // Preparado para 1:N a futuro, pero el MVP asume 1 por Cuidador Principal.
    public Guid CuidadorPrincipalId { get; init; } 
    public Usuario CuidadorPrincipal { get; init; } = null!;

    public string NombreCompleto { get; private set; } = string.Empty;
    public TipoSangre TipoSangre { get; private set; }
    public string CondicionesCronicas { get; private set; } = string.Empty; // Texto libre
    
    // Usamos PostgreSQL Arrays o JSONB (EF Core 8+ Primitive Collections)
    public List<string> AlergiasEstructuradas { get; private set; } = []; 
    
    // Owned Type mapeado a columna JSONB
    public List<ContactoEmergencia> ContactosEmergencia { get; private set; } = [];

    // 🚨 Concurrencia Nativa Postgres (Optimistic Concurrency)
    [Timestamp]
    public uint Version { get; private set; } 
}

public class ContactoEmergencia
{
    public string Nombre { get; set; } = string.Empty;
    public string Relacion { get; set; } = string.Empty;
    public string TelefonoWhatsApp { get; set; } = string.Empty;
}
```

#### `BloqueRelevo` (Contrato Base - Preparación)
```csharp
public class BloqueRelevo
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid PerfilDependienteId { get; init; }
    
    // Estricto: UTC en Base de Datos. La API transformará a America/Guayaquil.
    public DateTimeOffset InicioUtc { get; private set; }
    public DateTimeOffset FinUtc { get; private set; }
    
    public EstadoRelevo Estado { get; private set; }
    
    [Timestamp]
    public uint Version { get; private set; } 
}
```

### 1.2 Enums Tipados (Dominio)
Deben exponerse como strings al frontend (`.HasConversion<string>()`).
```csharp
public enum TipoSangre
{
    APositivo, ANegativo, BPositivo, BNegativo, 
    ABPositivo, ABNegativo, OPositivo, ONegativo, Desconocido
}

public enum EstadoRelevo
{
    Disponible, Asignado, Cancelado, Completado
}
```

---

## 2. Backend (FastEndpoints & Vertical Slice)
Organización: `Features/PerfilesDependientes/`
Se aplicará el **One Trip Pattern** para lecturas y respuestas **RFC 7807** para errores.

### 2.1 Endpoints Diseñados

#### `GET /api/perfiles-dependientes/mi-dependiente`
- **Autorización:** `Cuidador Principal` y `Apoyo`.
- **Mapeo de Husos Horarios:** Aunque el modelo no tiene fechas críticas aquí, dejamos el estándar listo.
- **Respuesta:**
  ```json
  {
    "id": "guid",
    "nombreCompleto": "Juan Pérez",
    "tipoSangre": "OPositivo",
    "condicionesCronicas": "Hipertensión",
    "alergiasEstructuradas": ["Penicilina", "Maní"],
    "contactosEmergencia": [
      { "nombre": "María", "relacion": "Hija", "telefonoWhatsApp": "+593900000000" }
    ],
    "version": 12345
  }
  ```

#### `POST /api/perfiles-dependientes`
- **Autorización:** Solo `Cuidador Principal`.
- **Validación:** No permite crear si el usuario ya tiene un perfil activo (MVP 1:1). Retorna **409 Conflict** (ProblemDetails).

#### `PUT /api/perfiles-dependientes/{id}`
- **Autorización:** Solo `Cuidador Principal`.
- **Validación:** Requiere el campo `version` en el payload para verificar la concurrencia.
- **Errores (RFC 7807):** 
  - Si el `version` no coincide -> `409 Conflict` (Optimistic Concurrency).
  - Si las validaciones del request fallan -> `400 Bad Request` con el campo `Detail` con la lista de errores para Zod.

---

## 3. Frontend (React 19 + Zod + Dual Views)

### 3.1 Zod Schemas (Día Cero)
Totalmente alineados con los DTOs de C#.

```typescript
import { z } from "zod";

export const ContactoEmergenciaSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  relacion: z.string().min(2, "La relación es obligatoria"),
  telefonoWhatsApp: z.string().regex(/^\+593\d{9}$/, "Debe ser un número de Ecuador válido (+593...)")
});

export const PerfilDependienteSchema = z.object({
  nombreCompleto: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  tipoSangre: z.enum(["APositivo", "ANegativo", "BPositivo", "BNegativo", "ABPositivo", "ABNegativo", "OPositivo", "ONegativo", "Desconocido"]),
  condicionesCronicas: z.string(),
  alergiasEstructuradas: z.array(z.string()),
  contactosEmergencia: z.array(ContactoEmergenciaSchema).max(3, "Máximo 3 contactos de emergencia")
});
```

### 3.2 SWR y Optimistic UI (Zero-Wait Policy)
El consumo se hace mediante el hook autogenerado por Orval.
```typescript
const { data, mutate } = useGetMiDependiente();

const actualizarFicha = async (datosNuevos) => {
  // Mutación Optimista (Zero-Wait)
  mutate({ ...data, ...datosNuevos }, false); 
  
  try {
    await api.putPerfilDependiente(datosNuevos);
    mutate(); // Revalidación background
  } catch (error) {
    if (error.response?.status === 409) {
      toast.error("Alguien más actualizó la ficha. Recargando...");
    }
    mutate(); // Rollback automático
  }
};
```

### 3.3 Estructura de Carpetas (Frontend)
```
src/
  lib/
    schemas/
      perfilDependiente.ts       # Zod Schemas
  views/
    PerfilDependiente/
      PerfilDependienteDesktop.tsx   # Vista Desktop (Gestión completa)
      PerfilDependienteMobile.tsx    # Vista Mobile (Táctica)
      SOSMobile.tsx                  # Vista SOS (Emergencia)
      ContactosEmergenciaForm.tsx    # Subcomponente reutilizable
  routes/
    _protegidas/
      perfil-dependiente.tsx         # Ruta
```

### 3.4 Componentes Detallados

#### `PerfilDependienteDesktop.tsx`
- **Estado:** Carga inicial mediante SWR, luego forma editable.
- **Campos del Formulario:**
  - Nombre Completo (readonly después de creación)
  - Tipo de Sangre (select)
  - Condiciones Crónicas (textarea)
  - Alergias (campo de array con botones +/- para agregar/quitar)
  - Contactos de Emergencia (tabla editable, máx. 3)
- **Validación:** React Hook Form + Zod inferido.
- **Botones de Acción:**
  - "Guardar" (POST o PUT según exista perfil)
  - "Ver Emergencia (SOS)" (Link a SOSMobile)
- **Manejo de Errores:** Toast con RFC 7807 Detail. Para 409, mostrar "Conflicto de Concurrencia - Recargando...".

#### `PerfilDependienteMobile.tsx`
- **Lectura primaria:** Renderiza el perfil existente en modo condensado.
- **Botón Grande SOS:** Link a SOSMobile que ocupa el 80% del ancho, fondo `bg-red-600`.
- **Edición:** Botón "Editar" que muestra una modal o redirige a un formulario compacto.

#### `SOSMobile.tsx`
- **Estado:** Lectura pura (no editable).
- **Alergias:** Sección con fondo `bg-amber-100`, bordes `border-2 border-amber-400`.
  - Encabezado: "⚠️ Alergias"
  - Lista de alergias con badges de color naranja.
  - Si está vacía, mostrar "Sin alergias registradas".
- **Contactos de Emergencia:** Sección con botones uno por cada contacto.
  - Botón 1: "📞 {Nombre}" -> `href="tel:+593..."`
  - Botón 2: "💬 WhatsApp {Nombre}" -> `href="https://wa.me/+593...?text=Necesito%20ayuda"`
  - Estilo: Botones block, `bg-green-600` para WhatsApp, `bg-blue-600` para teléfono.
- **Footer:** Timestamp "Actualizado el {fecha}".

#### `ContactosEmergenciaForm.tsx`
- Subcomponente reutilizable que maneja la lógica de agregar/quitar contactos.
- Props: `contactos`, `onChange`, `errores`.
- Renderiza tabla (Desktop) o lista (Mobile).

### 3.5 Integración SWR (Orval)
Una vez que se ejecute `npm run api:generate`, los hooks generados serán:
- `useGetMiDependiente()` -> GET /api/perfiles-dependientes/mi-dependiente
- `useCreatePerfilDependiente()` -> POST /api/perfiles-dependientes
- `useUpdatePerfilDependiente(id)` -> PUT /api/perfiles-dependientes/{id}

**Patrón de Mutación Optimista:**
```typescript
const { data, mutate, error } = useGetMiDependiente();
const { trigger: actualizarPerfil, isMutating } = useUpdatePerfilDependiente(id);

const handleGuardar = async (formData) => {
  // Optimistic UI: actualizar estado local inmediatamente
  const datosAntiguos = data;
  mutate({ ...data, ...formData }, false);
  
  try {
    await actualizarPerfil(formData);
    mutate(); // Revalidar en background
  } catch (err) {
    if (err.response?.status === 409) {
      toast.error("Conflicto: Alguien más actualizó la ficha. Recargando...");
    } else if (err.response?.status === 400) {
      toast.error(err.response.data?.detail || "Error de validación");
    }
    mutate(); // Rollback automático
  }
};
```

### 3.6 Rutas TanStack Router
```typescript
// routes/_protegidas/perfil-dependiente.tsx
export const perfilDependienteRoute = createFileRoute(
  '/_protegidas/perfil-dependiente'
)({
  component: PerfilDependienteView,
});

function PerfilDependienteView() {
  const isMobile = useIsMobile(); // Hook personalizado: window.innerWidth < 768
  return isMobile ? <PerfilDependienteMobile /> : <PerfilDependienteDesktop />;
}
```

### 3.7 Paleta de Colores (Strict)
- Fondo principal: `bg-blue-50`
- Texto: `text-blue-900`
- Botones primarios: `bg-sky-600 hover:bg-sky-700`
- Alertas/Advertencias: `bg-amber-100 text-amber-900`
- Emergencia/SOS: `bg-red-600 hover:bg-red-700`
- Contactos WhatsApp: `bg-green-600 hover:bg-green-700`
- Bordes sutiles: `border-blue-200`
