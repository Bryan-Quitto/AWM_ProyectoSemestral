# Spec #1 — Flujo de Invitación y Completar Perfil

> **Estado:** Borrador para aprobación (v2 — refactor por transacción distribuida, zero-trust y redirección inversa).
> **Dominio:** Usuarios.
> **Stack afectado:** `RACPD.Backend` (.NET 10 + EF Core + FastEndpoints) y `RACPD.Frontend` (React 19 + Vite + Tailwind + Zod + SWR + Orval + `@supabase/supabase-js`).
> **Alineado a:** `SKILLS.md` y `AGENTS.md`. Idioma: **español en todo** (DTOs, enums, UI, migraciones, errores).

---

## 0.1 Decisiones arquitectónicas críticas (refactor v2)

| # | Decisión | Razón |
|---|---|---|
| 1 | **El backend nunca recibe la contraseña del usuario.** El cambio de contraseña se hace directamente contra Supabase desde el frontend usando `supabase.auth.updateUser({ password })`. | Zero-Trust: el backend no debe actuar como proxy de secretos ni manejar contraseñas en tránsito. Evita fugas en logs, trazas, request bodies cacheados o cualquier intermediario. |
| 2 | **No existe transacción distribuida backend ↔ Supabase.** El backend solo actualiza `Nombre/Apellido/PerfilCompleto` en la BD local. La contraseña se cambia contra el IdP en un paso previo, sin acoplamiento. | Una caída de BD o timeout entre pasos no puede dejar al usuario con contraseña cambiada pero perfil incompleto (o viceversa). Cada sistema es responsable de su propia consistencia. |
| 3 | **Las políticas de contraseña (longitud, caracteres) se configuran en el panel de Supabase Auth**, no en código .NET. | El IdP es la fuente de verdad de identidad; el backend no debe duplicar reglas que ya residen en Supabase. |
| 4 | **El frontend orquesta el orden**: primero `supabase.auth.updateUser`, luego (solo si OK) `PUT /api/usuarios/mi-perfil`. | Mantiene ambos sistemas desacoplados y permite reintentos seguros. |
| 5 | **Redirección inversa en el guard**: si `PerfilCompleto=true` y el usuario navega manualmente a `/completar-perfil`, el `beforeLoad` de esa ruta lanza `redirect({ to: '/' })`. | Evita que un usuario con perfil completo renderice y reenvíe el formulario. |

---

## 0. Contexto y motivación

El módulo de invitación actual permite que el `AdministradorSistema` registre Nombre y Apellido del invitado en nombre de éste. Esto viola el principio de "Single Source of Truth" en datos de salud:

- Datos personales son inventados/erróneamente transcritos por un tercero.
- Usuarios que no aceptan la invitación quedan con datos fantasma.
- El cuidador jamás valida su propia identidad en el sistema.

Este spec redefine el flujo para que el cuidador invitado sea quien ingrese sus datos al aceptar el magic link de Supabase, mediante un paso obligatorio de **Completar Perfil** antes de acceder a la aplicación.

---

## 1. Modelo de Datos

### 1.1 Entidad `Usuario` (modificada)

```csharp
// RACPD.Backend/Domain/Entities/Usuario.cs
public class Usuario
{
    public Guid Id { get; set; }
    public string Correo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Apellido { get; set; } = string.Empty;
    public Rol Rol { get; set; }
    public bool PerfilCompleto { get; set; }      // NUEVO
    public DateTimeOffset FechaCreacion { get; set; } = DateTimeOffset.UtcNow; // NUEVO
    public DateTimeOffset? FechaCompletadoPerfil { get; set; } // NUEVO (nullable)
}
```

### 1.2 Enum `Rol` (sin cambios)

```csharp
// AdministradorSistema = 0, CuidadorPrincipal = 1, Apoyo = 2
// Expuesto como string en API (HasConversion<string>())
```

### 1.3 Migración EF Core

```bash
dotnet ef migrations add AddPerfilCompletoToUsuario --project RACPD.Backend
```

- `PerfilCompleto`: `bool`, `NOT NULL`, `DEFAULT false`.
- `FechaCreacion`: `timestamptz`, `NOT NULL`, `DEFAULT now()`.
- `FechaCompletadoPerfil`: `timestamptz`, `NULL`.
- Importante: los registros existentes (administradores creados manualmente o vía invitación previa) deben backfillarse a `PerfilCompleto = true`, `FechaCompletadoPerfil = now()` mediante un `data migration` dentro del `Up()`.

### 1.4 Concurrencia

No se requiere `RowVersion` para este flujo. La edición de perfil es 1-1 con el usuario autenticado y no hay conflicto multi-actor.

---

## 2. Backend — FastEndpoints

### 2.1 `InvitarEndpoint` (modificar)

**Ruta:** `POST /api/usuarios/invitar`
**Roles permitidos:** `AdministradorSistema`
**Request (nuevo):**

```csharp
public record InvitarUsuarioRequest(string Correo, Rol Rol);
public record InvitarUsuarioResponse(string Mensaje, string Correo);
```

**Cambios respecto al actual:**

1. Eliminar `Nombre` y `Apellido` del request y de la creación de `Usuario`.
2. Validar con `FluentValidation`:
   - `Correo`: `NotEmpty`, `EmailAddress`.
   - `Rol`: debe ser un valor válido del enum (FastEndpoints lo hace automáticamente).
3. Persistir `PerfilCompleto = false`, `FechaCreacion = UtcNow` (convertido a `America/Guayaquil` solo para presentación si fuera necesario).
4. **Manejo de re-invitación:** Si `InviteUserByEmail` falla porque el usuario ya existe en Supabase, devolver `ProblemDetails` con código 409:

```json
{
  "type": "https://racpd.app/errores/usuario-ya-invitado",
  "title": "Usuario ya invitado",
  "status": 409,
  "detail": "Este correo ya fue invitado anteriormente. Pídele al usuario que use 'Olvidé mi contraseña' o revise su bandeja de entrada.",
  "instance": "/api/usuarios/invitar"
}
```

5. **Reemplazar** `HttpContext.Response.WriteAsJsonAsync` por `Send.OkAsync(...)` (One Trip Pattern).
6. **Eliminar** el `try/catch` general; usar `AddError`/`ThrowIfAnyErrors` para que FastEndpoints emita el ProblemDetails por sí mismo.

### 2.2 `ObtenerMiPerfilEndpoint` (nuevo)

**Ruta:** `GET /api/usuarios/mi-perfil`
**Auth:** usuario autenticado (cualquier rol).
**Response:**

```csharp
public record MiPerfilResponse(
    Guid Id,
    string Correo,
    string Nombre,
    string Apellido,
    string Rol,
    bool PerfilCompleto
);
```

**Comportamiento:**

- Leer `Usuario` desde BD por `Id = User.GetUserId()` (helper que extrae el `sub` del JWT).
- Si el usuario autenticado no existe en la tabla local (caso huérfano), devolver `404 Not Found` con ProblemDetails.
- Devolver DTO (nunca la entidad EF).

### 2.3 `CompletarPerfilEndpoint` (nuevo)

**Ruta:** `PUT /api/usuarios/mi-perfil`
**Auth:** usuario autenticado con `PerfilCompleto = false`. Si ya completó, devolver `409 Conflict`.
**Importante:** Este endpoint **NO recibe ni maneja contraseñas**. La contraseña se cambia directamente contra Supabase desde el frontend antes de invocar este endpoint.

**Request:**

```csharp
public record CompletarPerfilRequest(
    string Nombre,
    string Apellido
);
```

**Validaciones (`FluentValidation`):**

- `Nombre`: `NotEmpty`, `MinimumLength(2)`, `MaximumLength(80)`, solo letras, espacios, apóstrofes y guiones (regex `^[\p{L}\s'-]+$`).
- `Apellido`: mismas reglas que Nombre.

**Comportamiento:**

1. Obtener el `Usuario` actual por `Id` extraído del JWT. Si no existe → `404 Not Found` con ProblemDetails.
2. Si `PerfilCompleto == true` → `409 Conflict` con ProblemDetails: `"El perfil ya fue completado anteriormente."`.
3. Actualizar `Nombre`, `Apellido`, `PerfilCompleto = true`, `FechaCompletadoPerfil = UtcNow`.
4. `SaveChangesAsync` en una sola transacción EF local.
5. Respuesta exitosa: `200 OK` con `MiPerfilResponse` actualizado.

**No existe helper de Política de Contraseña en el backend.** Las reglas de complejidad se configuran en el panel de Supabase Auth (Authentication → Sign In/Up → Password Strength). El frontend puede ofrecer feedback visual adicional, pero la validación autoritativa la ejecuta Supabase.

### 2.4 Husos Horarios

- Todos los `DateTimeOffset` se almacenan en UTC.
- La presentación al cliente puede convertir a `America/Guayaquil` (`TimeZoneInfo.FindSystemTimeZoneById("America/Guayaquil")`).

---

## 3. Frontend — React 19

### 3.1 Regeneración de Orval (prerrequisito)

1. Backend debe estar corriendo: `dotnet run` desde `RACPD.Backend/`.
2. Frontend: `npm run api:generate`.
3. Verificar que se generen:
   - `RACPDBackendFeaturesUsuariosInvitarInvitarUsuarioRequest` (sin `nombre`/`apellido`).
   - `RACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfil*`.
   - `RACPDBackendFeaturesUsuariosMiPerfilCompletarMiPerfil*`.

### 3.2 Modificaciones a Invitar

**Archivos afectados:**

- `src/views/Usuarios/Invitar/schema.ts` — quitar `nombre`, `apellido` del Zod schema.
- `src/views/Usuarios/Invitar/InvitarDesktop.tsx` — quitar inputs.
- `src/views/Usuarios/Invitar/InvitarMobile.tsx` — quitar inputs.
- `src/views/Usuarios/Invitar/InvitarContenedor.tsx` — quitar defaults.

**Nuevo schema:**

```typescript
import { z } from 'zod';
import { RACPDBackendDomainEnumsRol } from '../../../api/generated/model';

export const invitarUsuarioSchema = z.object({
  correo: z.string().min(1, 'El correo es requerido.').email('El correo no tiene un formato válido.'),
  rol: z.nativeEnum(RACPDBackendDomainEnumsRol, {
    message: 'Debes seleccionar un rol válido.'
  })
});
```

### 3.3 Vista `CompletarPerfil` (nueva)

**Estructura de carpetas:**

```
src/views/Usuarios/CompletarPerfil/
├── CompletarPerfilContenedor.tsx
├── CompletarPerfilDesktop.tsx
├── CompletarPerfilMobile.tsx
└── schema.ts
```

**Schema Zod (frontend):**

```typescript
// src/views/Usuarios/CompletarPerfil/schema.ts
import { z } from 'zod';

export const contrasenaSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula.')
  .regex(/[a-z]/, 'Debe incluir al menos una minúscula.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial.');

export const completarPerfilSchema = z
  .object({
    nombre: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(80, 'El nombre no puede superar los 80 caracteres.')
      .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, apóstrofes y guiones.'),
    apellido: z
      .string()
      .min(2, 'El apellido debe tener al menos 2 caracteres.')
      .max(80, 'El apellido no puede superar los 80 caracteres.')
      .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, apóstrofes y guiones.'),
    contrasena: contrasenaSchema,
    confirmarContrasena: z.string().min(1, 'Confirma tu contraseña.')
  })
  .refine((data) => data.contrasena === data.confirmarContrasena, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena']
  });
```

> **Aclaración importante:** La política anterior es **solo feedback visual para el usuario**. La validación autoritativa la ejecuta Supabase Auth en `supabase.auth.updateUser`. Si la contraseña no cumple la política configurada en el panel de Supabase, ese SDK devolverá un error que el frontend debe mostrar.

**`CompletarPerfilContenedor.tsx`:**

- Usa `useForm<z.infer<typeof completarPerfilSchema>>({ resolver: zodResolver(...) })`.
- Instancia del cliente Supabase (vía `@supabase/supabase-js`, configurado con la `SUPABASE_URL` y la **anon key** del frontend, NO service role).
- Hook de Orval para el GET (`useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint`) → estado derivado para `PerfilCompleto`, `Rol`, `Nombre`, `Apellido`.
- Hook de Orval para el PUT (`useRACPDBackendFeaturesUsuariosMiPerfilCompletarMiPerfilEndpoint`).
- **Orquestación del `onSubmit` en dos pasos:**

```typescript
const onSubmit = async (data: CompletarPerfilForm) => {
  setApiError(null);
  try {
    // PASO 1: Cambiar contraseña directamente contra Supabase (Zero-Trust).
    // El JWT del usuario autenticado viaja en el cliente de Supabase.
    const { error: errorContrasena } = await supabase.auth.updateUser({
      password: data.contrasena
    });

    if (errorContrasena) {
      // Supabase rechazó la contraseña (política, sesión expirada, etc.).
      setApiError(errorContrasena.message);
      return;
    }

    // PASO 2: Solo si Supabase aceptó, persistir Nombre/Apellido en el backend.
    const { error: errorPerfil } = await triggerCompletarPerfil({
      nombre: data.nombre,
      apellido: data.apellido
    });

    if (errorPerfil) {
      // El backend devolvió un ProblemDetails.
      setApiError(mapearProblemDetails(errorPerfil));
      return;
    }

    // Invalidar caché de SWR para que el guard refleje el nuevo estado.
    await mutate(['mi-perfil']);
    navigate({ to: '/' });
  } catch {
    setApiError('No se pudo conectar al servidor.');
  }
};
```

- Dual View: `window.innerWidth < 768` → Mobile, sino Desktop (mismo patrón que `InvitarContenedor`).
- Manejo de errores de Supabase: traducir mensajes al español cuando vengan en inglés (mensajes comunes: "Password should be at least 8 characters", "Password is too weak", etc.).

**`CompletarPerfilDesktop.tsx`:**

- Layout: tarjeta central con padding generoso (`max-w-2xl`), esquinas `rounded-xl`, sombra suave, borde `border-blue-100`.
- Título: "Completa tu perfil".
- Subtítulo: "Necesitamos unos datos para que puedas empezar a usar la plataforma."
- Campos:
  - `Nombre` (texto, autofocus).
  - `Apellido` (texto).
  - **Rol** — `<input type="text" value={rolTextoLegible} disabled />` con clase `cursor-not-allowed` y `<p>` pequeño: *"Este rol fue asignado por el administrador y no puede modificarse."*
  - `Contraseña` (usar `CampoContrasena`).
  - `Confirmar contraseña` (usar `CampoContrasena`).
  - Debajo del campo contraseña: `IndicadorFortalezaContrasena` (ver §3.5).
- Botón primario: "Guardar y continuar" con estado de carga y texto que indique claramente que está cambiando la contraseña y guardando el perfil.

**`CompletarPerfilMobile.tsx`:**

- Mismo contenido, padding más compacto, `rounded-2xl`, foco en área táctil grande (mínimo 44x44 px en cada input).

### 3.4 Guard de Redirección

El flujo de redirección tiene **dos direcciones** y ambas deben estar cubiertas:

#### 3.4.1 Guard de redirección hacia `/completar-perfil`

Aplicado en `src/routes/_protegidas.tsx`:

```typescript
// src/routes/_protegidas.tsx
export const Route = createFileRoute('/_protegidas')({
  beforeLoad: async ({ context, location }) => {
    if (!context.isAuthenticated()) {
      throw redirect({ to: '/inicio-sesion' });
    }

    // Evitar bucle si ya está en /completar-perfil.
    if (location.pathname === '/completar-perfil') return;

    const perfil = await context.obtenerMiPerfil(); // SWR cacheado
    if (perfil && !perfil.perfilCompleto) {
      throw redirect({ to: '/completar-perfil' });
    }
  },
  component: LayoutPrincipal
});
```

#### 3.4.2 Guard de redirección inversa (¡crítico!)

Aplicado en `src/routes/_protegidas/completar-perfil.tsx`. Si el usuario ya tiene `PerfilCompleto=true` y navega manualmente a esta ruta (URL pegada en el navegador, marcador, deep link), el `beforeLoad` debe redirigirlo a `/`:

```typescript
// src/routes/_protegidas/completar-perfil.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { CompletarPerfilContenedor } from '../../views/Usuarios/CompletarPerfil/CompletarPerfilContenedor';

export const Route = createFileRoute('/_protegidas/completar-perfil')({
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated()) {
      throw redirect({ to: '/inicio-sesion' });
    }

    const perfil = await context.obtenerMiPerfil();
    if (perfil?.perfilCompleto === true) {
      // Redirección inversa: usuario con perfil completo NO debe ver este formulario.
      throw redirect({ to: '/' });
    }
  },
  component: CompletarPerfilContenedor
});
```

**Razón:** sin este guard inverso, un usuario que ya completó su perfil podría acceder a la vista, ver el formulario pre-llenado (o vacío), y reenviar un PUT que el backend rechazaría con 409, pero la pantalla mostraría UI confusa y un posible mensaje de error inesperado. Más importante aún, evita que cualquier lógica condicional interna del componente entre en estados inválidos.

#### 3.4.3 Implementación de `context.obtenerMiPerfil`

- En `__root.tsx` o `main.tsx`, exponer un provider con SWR key `['mi-perfil']`.
- Cachear el resultado (Zero-Wait Policy).
- Si la petición falla, **no bloquear la navegación**; retornar `null` y dejar que el componente decida.
- Tras `PUT /api/usuarios/mi-perfil` exitoso, hacer `mutate(['mi-perfil'])` para que el guard detecte el cambio de estado en la siguiente navegación.

### 3.5 Componentes Compartidos (nuevos)

**Carpeta:** `src/views/Compartidos/Seguridad/`

```
src/views/Compartidos/Seguridad/
├── CampoContrasena.tsx            # Input con ojito mostrar/ocultar
├── IndicadorFortalezaContrasena.tsx  # Barra + lista de requisitos
└── usePoliticaContrasena.ts       # Hook puro
```

**`usePoliticaContrasena.ts`:**

```typescript
export type NivelFortaleza = 'vacia' | 'debil' | 'media' | 'fuerte';

export const usePoliticaContrasena = (contrasena: string) => {
  return useMemo(() => {
    const requisitos = {
      longitud: contrasena.length >= 8,
      mayuscula: /[A-Z]/.test(contrasena),
      minuscula: /[a-z]/.test(contrasena),
      digito: /[0-9]/.test(contrasena),
      especial: /[^A-Za-z0-9]/.test(contrasena)
    };

    const cumplidos = Object.values(requisitos).filter(Boolean).length;

    let nivel: NivelFortaleza = 'vacia';
    if (contrasena.length === 0) nivel = 'vacia';
    else if (cumplidos <= 2) nivel = 'debil';
    else if (cumplidos <= 4) nivel = 'media';
    else nivel = 'fuerte';

    return { requisitos, nivel, cumplidos };
  }, [contrasena]);
};
```

**`IndicadorFortalezaContrasena.tsx`:**

- Barra horizontal con 3 segmentos (débil/medio/fuerte). Colores:
  - Débil: rojo suave.
  - Medio: amarillo.
  - Fuerte: verde.
- Lista debajo con check/cruz por cada requisito, usando los mismos tonos.

**`CampoContrasena.tsx`:**

```typescript
type CampoContrasenaProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
};
```

- Botón ojito a la derecha del input.
- Mantiene estado local de visibilidad (`mostrar: boolean`).
- Estilo coherente con paleta azul/celeste.

### 3.6 Paleta y Estilo

- Mantener estrictamente `azul`/`celeste`/`blanco`.
- Inputs: `border-blue-200`, focus `ring-blue-500`.
- Errores: `bg-red-50 border-red-200 text-red-700`.
- Éxitos: `bg-green-50 border-green-200 text-green-700`.
- Fondo de página: `bg-blue-50/30` o gradiente suave azul.

---

## 4. Criterios de Aceptación

### Backend

- [ ] La migración agrega `PerfilCompleto`, `FechaCreacion`, `FechaCompletadoPerfil` y backfillea registros existentes.
- [ ] `InvitarEndpoint` rechaza con `400` si el request trae `nombre` o `apellido` (no existen en el DTO regenerado).
- [ ] `InvitarEndpoint` devuelve `409 Conflict` con ProblemDetails cuando el correo ya existe en Supabase.
- [ ] `ObtenerMiPerfilEndpoint` devuelve `404` si el usuario autenticado no está en la tabla local.
- [ ] `CompletarPerfilEndpoint` rechaza con `409` si `PerfilCompleto=true`.
- [ ] `CompletarPerfilRequest` **NO contiene campos de contraseña**.
- [ ] **No existe `PoliticaContrasena.cs`** ni equivalente en el backend. Las políticas de complejidad se configuran en Supabase Auth.
- [ ] Todos los errores son **RFC 7807 ProblemDetails** con `Detail` legible.
- [ ] Todos los endpoints autenticados validan vía JWKS (RS256).

### Frontend

- [ ] TS estricto: **sin `any`**, sin `!`, sin `as` destructivos.
- [ ] Zod es la única fuente de validación de formularios del frontend.
- [ ] El schema de `Invitar` no contiene `nombre`/`apellido` tras la regeneración.
- [ ] `CompletarPerfil` tiene Dual Views (Mobile + Desktop).
- [ ] El campo `Rol` es `<input disabled>` con `cursor-not-allowed` y mensaje explicativo.
- [ ] `CampoContrasena` y `IndicadorFortalezaContrasena` son componentes compartidos sin lógica de negocio duplicada.
- [ ] **`onSubmit` ejecuta primero `supabase.auth.updateUser({ password })` y solo después el PUT al backend.** Si Supabase rechaza, el PUT nunca se llama.
- [ ] El backend nunca recibe la contraseña en texto plano en ninguna request. Verificable inspeccionando el body del PUT: solo `{ nombre, apellido }`.
- [ ] El guard de `_protegidas.tsx` redirige a `/completar-perfil` cuando `PerfilCompleto=false`.
- [ ] **El guard de `/completar-perfil` redirige a `/` cuando `PerfilCompleto=true`** (redirección inversa).
- [ ] Paleta azul/celeste/blanco consistente.
- [ ] No se usa `useEffect` para sincronizar SWR con estado local; se usa **estado derivado**.
- [ ] Tras completar perfil, se invalida el caché `['mi-perfil']` con `mutate()` y se redirige a `/`.

---

## 5. Plan de Verificación

1. Compilar backend: `dotnet build` → 0 errores.
2. Generar migraciones y aplicarlas: `dotnet ef database update`.
3. Backend arriba: `dotnet run`. Verificar Swagger en `/swagger`. Confirmar que `PUT /api/usuarios/mi-perfil` **NO muestra campos de contraseña** en su contrato.
4. Regenerar contratos: `npm run api:generate` desde `RACPD.Frontend/`. Confirmar que el tipo generado `RACPDBackendFeaturesUsuariosMiPerfilCompletarMiPerfilRequest` solo tiene `nombre` y `apellido`.
5. Compilar frontend: `npm run build` → 0 errores TS.
6. Configurar política de contraseña en Supabase Auth: longitud mínima 8, al menos 1 mayúscula, 1 minúscula, 1 dígito, 1 carácter especial.
7. Pruebas manuales:
   - Login como admin → invitar `cuidador1@test.com` con rol `CuidadorPrincipal`.
   - Verificar en BD que se creó fila con `perfil_completo = false`.
   - Intentar re-invitar mismo correo → debe devolver 409 ProblemDetails.
   - Login como `cuidador1@test.com` (Supabase magic link o contraseña temporal).
   - Verificar que el guard redirige a `/completar-perfil`.
   - **Inspeccionar el body de la request PUT al backend**: debe ser `{ nombre, apellido }`, sin contraseña.
   - **Inspeccionar las DevTools → Network → request a `supabase.co/auth/v1/user`**: ahí sí viaja la contraseña, no al backend.
   - Completar formulario con contraseña débil → Supabase debe rechazarla y mostrar el error; el PUT al backend **no debe ejecutarse**.
   - Completar con contraseña válida → debe redirigir a `/`.
   - Verificar que `perfil_completo = true` en BD.
   - Logout/login → debe entrar directo a `/` sin redirigir.
   - **Test de redirección inversa**: estando logueado con perfil completo, pegar manualmente `https://app/completar-perfil` en el navegador → debe redirigir a `/`.
   - **Test de seguridad de logs**: revisar logs del backend, trazas, etc., buscando la contraseña del usuario; **no debe aparecer en ningún lado**.

---

## 6. Fuera de Alcance (Spec #2)

Las siguientes funcionalidades quedan explícitamente fuera y se abordarán en una segunda iteración:

- Vista `/configuracion/mi-perfil` editable.
- Vista `/configuracion/seguridad` con cambio de contraseña.
- Item "Configuración" en el sidebar.
- Layout `LayoutConfiguracion` con sub-rutas.
- Reutilización de `CampoContrasena`/`IndicadorFortalezaContrasena` en cambio de contraseña.

---

## 7. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| El usuario ya tenía cuenta en Supabase y no pasa por "Completar Perfil" | Backfill en migración: registros previos a este deploy → `PerfilCompleto = true`. |
| El usuario crea cuenta vía Supabase sin invitación | El login fallará (`El usuario no está registrado en el sistema local`). Aceptable: el modelo exige invitación del admin. |
| Frontend desactualizado tras regenerar Orval | El equipo debe correr `npm run api:generate` antes de cualquier cambio en invitación/perfil. Documentar en README. |
| Contraseña débil elegida por el cuidador | Política configurada en el panel de Supabase Auth (autoritativa) + indicador visual de fortaleza en el frontend (solo feedback). |
| Race condition entre dos pestañas | El guard usa SWR cacheado; si la otra pestaña completa primero, la siguiente navegación recibirá `PerfilCompleto=true` y entrará a `/`. |
| Caída de BD local entre `supabase.auth.updateUser` y `PUT /api/usuarios/mi-perfil` | La contraseña en Supabase queda cambiada, pero el perfil local queda incompleto. El usuario podrá reintentar el PUT sin problema (la contraseña ya está seteada y solo se reescribe `Nombre/Apellido/PerfilCompleto`). Si Supabase falla primero, el PUT nunca se ejecuta → estado consistente. |
| Sesión Supabase expirada al llegar a `/completar-perfil` | `supabase.auth.updateUser` retorna error de sesión; el frontend muestra "Tu sesión expiró, vuelve a iniciar sesión" y enlaza a `/inicio-sesion`. |
| Fuga de contraseña en logs del backend | Mitigada por diseño: el backend nunca recibe la contraseña. |

---

## 8. Resumen de Archivos a Crear / Modificar

**Backend (crear):**
- `Features/Usuarios/MiPerfil/ObtenerMiPerfilEndpoint.cs`
- `Features/Usuarios/MiPerfil/CompletarPerfilEndpoint.cs`

**Backend (modificar):**
- `Domain/Entities/Usuario.cs`
- `Features/Usuarios/Invitar/InvitarEndpoint.cs`
- Nueva migración: `Migrations/<timestamp>_AddPerfilCompletoToUsuario.cs`

**Frontend (crear):**
- `src/views/Usuarios/CompletarPerfil/CompletarPerfilContenedor.tsx`
- `src/views/Usuarios/CompletarPerfil/CompletarPerfilDesktop.tsx`
- `src/views/Usuarios/CompletarPerfil/CompletarPerfilMobile.tsx`
- `src/views/Usuarios/CompletarPerfil/schema.ts`
- `src/views/Compartidos/Seguridad/CampoContrasena.tsx`
- `src/views/Compartidos/Seguridad/IndicadorFortalezaContrasena.tsx`
- `src/views/Compartidos/Seguridad/usePoliticaContrasena.ts` (helper de feedback visual, **NO** validaciones autoritativas)
- `src/lib/supabase.ts` (cliente `@supabase/supabase-js` con anon key para uso desde el navegador)
- `src/routes/_protegidas/completar-perfil.tsx` (con guard de redirección inversa)

**Frontend (modificar):**
- `src/views/Usuarios/Invitar/schema.ts`
- `src/views/Usuarios/Invitar/InvitarContenedor.tsx`
- `src/views/Usuarios/Invitar/InvitarDesktop.tsx`
- `src/views/Usuarios/Invitar/InvitarMobile.tsx`
- `src/routes/_protegidas.tsx` (guard de perfil incompleto)
- `src/main.tsx` o `__root.tsx` (provider SWR para `mi-perfil`)
- `package.json` (agregar dependencia `@supabase/supabase-js`)

**Frontend (regenerar):**
- Todo lo bajo `src/api/generated/**` vía `npm run api:generate`.

**Configuración externa (manual, fuera de código):**
- Panel Supabase → Authentication → Sign In/Up → Password Strength: configurar mínimo 8 caracteres, mayúscula, minúscula, dígito, carácter especial.
