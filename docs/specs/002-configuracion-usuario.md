# Spec 002: Configuración de Usuario (Perfil y Contraseña)

## 1. Objetivo
Proveer a los usuarios (Cuidadores y Apoyo) una interfaz accesible y estandarizada para visualizar y modificar sus datos personales básicos y gestionar la seguridad de su cuenta (cambio de contraseña), reutilizando componentes existentes.

## 2. Modelo de Datos y Backend (FastEndpoints)
Dado que ya existe `PUT /api/usuarios/mi-perfil` (que podría usarse para completar el perfil), el flujo se dividirá para respetar el *Single Responsibility Principle*:

1. **Endpoint: Actualizar Perfil**
   - `PUT /api/usuarios/mi-perfil/actualizar`
   - **Request:** `{ nombre: string, apellido: string }`
   - **Response:** `200 OK` (Vacio o DTO del perfil actualizado) | `400 Bad Request` (RFC 7807)

2. **Endpoint: Modificar Contraseña**
   - `PUT /api/usuarios/mi-perfil/contrasena`
   - **Request:** `{ contrasenaActual: string, nuevaContrasena: string }`
   - **Response:** `200 OK` | `400 Bad Request` (RFC 7807)
   - *Nota:* Supabase gestiona la autenticación, por lo que el Backend actuará como orquestador usando el SDK Admin de Supabase para cambiar la contraseña, o el Frontend consumirá directamente `supabase.auth.updateUser` según se defina en la implementación, pero se prefiere Backend como SSoT.

## 3. Frontend y UI (React + Vite + Tailwind)
Cumpliendo la **Arquitectura Dual Views**, se crearán las siguientes vistas en `src/views/Configuracion/`:

- `ConfiguracionDesktop.tsx`: Layout con panel lateral o sistema de pestañas grandes (Tabs) para separar "Datos Personales" y "Seguridad".
- `ConfiguracionMobile.tsx`: Layout apilado (Stack) optimizado para touch.

### 3.1. Reutilización de Componentes (AHA-UI)
- Importación estricta desde `src/components/`:
  - `<CampoContrasena />` para visualizar y ocultar el input.
  - `<IndicadorFortalezaContrasena />` vinculado a la nueva contraseña.
  - `usePoliticaContrasena()` para validaciones lógicas pre-Zod si aplica, aunque el esquema será la fuente de verdad.

### 3.2. Esquemas Zod (Zero-Indulgence)
```typescript
export const configuracionPerfilSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto").max(50),
  apellido: z.string().min(2, "El apellido es muy corto").max(50),
});

export const configuracionContrasenaSchema = z.object({
  contrasenaActual: z.string().min(1, "Requerido"),
  nuevaContrasena: z.string().min(8, "Mínimo 8 caracteres"),
  confirmarContrasena: z.string()
}).refine(data => data.nuevaContrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden",
  path: ["confirmarContrasena"]
});
```

### 3.3. Manejo de Estado (SWR)
- Los datos actuales del usuario se obtendrán vía `useRACPDBackendFeaturesUsuariosMiPerfilObtenerMiPerfilEndpoint()`.
- Al mutar (actualizar nombre/apellido), se usará el mutador de SWR para invalidar la caché y aplicar la política "Zero-Wait" con **Optimistic UI**, reflejando el cambio de nombre inmediatamente en la barra de navegación.

## 4. Criterios de Aceptación
1. **Regla Español:** Todo texto de error, placeholder y Zod enum está en español.
2. **Validación Segura:** No se pueden enviar contraseñas débiles al backend; Zod lo detiene primero.
3. **Manejo de Errores RFC 7807:** Si el usuario pone mal su "contraseña actual", el backend devuelve un ProblemDetails y la UI pinta el error debajo del campo correspondiente usando `setError` de `react-hook-form`.
4. **Paleta:** Botones de guardado en azul primario, validaciones en verde/rojo de tonos suaves (psicología de la salud).
