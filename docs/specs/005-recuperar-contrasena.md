# Spec #5 — Recuperar y Restablecer Contraseña

> **Estado:** ✅ **APROBADO Y CERRADO** (v6 — flujo probado end-to-end con éxito).
> **Dominio:** Identidad / Autenticación.
> **Stack afectado:** `RACPD.Frontend` (React 19 + Vite + Tailwind + Zod + `@supabase/supabase-js`). **Sin cambios en `RACPD.Backend`.**
> **Alineado a:** `SKILLS.md` y `AGENTS.md`. Idioma: **español en todo** (UI, errores, comentarios, validaciones, identificadores de variables/estado).

---

## 0. Decisiones arquitectónicas

| # | Decisión | Razón |
|---|---|---|
| 1 | **El backend nunca recibe ni valida la contraseña de recuperación.** El flujo se hace directo contra Supabase desde el cliente (`resetPasswordForEmail` + `updateUser`). | Consistencia con Spec #1 (Zero-Trust). El backend no debe actuar como proxy de secretos ni manejar credenciales en tránsito. |
| 2 | **El correo lo envía Supabase Auth con el SMTP configurado en su panel** (Brevo actualmente). No se introduce Resend ni SMTP propio en esta entrega. | Mantiene consistencia con la invitación actual (`InvitarEndpoint` ya hace `POST /auth/v1/invite`). Cero superficie nueva en backend. |
| 3 | **Mensaje neutro tras solicitar el enlace**: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña." | Previene enumeración de cuentas: un atacante no puede distinguir correos registrados de no registrados. |
| 4 | **El link del correo redirige a `${VITE_APP_URL}/restablecer-contrasena`**. Supabase adjunta un `access_token` con tipo `recovery` en el fragmento de la URL. | El contenedor de la vista detecta el evento `PASSWORD_RECOVERY` mediante `supabase.auth.onAuthStateChange` y monta la pantalla de restablecimiento con sesión temporal válida. |
| 5 | **Reutilización estricta**: `CampoContrasena`, `IndicadorFortalezaContrasena`, `usePoliticaContrasena`, `Boton`. Cero componentes nuevos en `src/components/`. | Regla de 3 (AHA-UI). Las primitivas ya existen, son agnósticas y suficientes. |
| 6 | **Dual Views obligatorio**: `RecuperarContrasenaDesktop`/`Mobile` y `RestablecerContrasenaDesktop`/`Mobile`. | SKILLS.md §"Arquitectura Dual Views". |
| 7 | **`routeTree.gen.ts` se regenera automáticamente** al levantar Vite tras crear los nuevos archivos de ruta. No editar a mano. | Convención de TanStack Router con file-based routing. |
| 8 | **Tras `updateUser` exitoso el usuario queda autenticado.** El contenedor ejecuta `navigate({ to: '/' })` directo al panel principal (NO a `/inicio-sesion`). Evita rebote contra `beforeLoad` de rutas protegidas o de login. | UX en salud: tras restablecer la credencial el cuidador debe quedar dentro de la app, sin pasos redundantes. La pantalla `/inicio-sesion` no debe mostrar nunca un usuario ya autenticado. |
| 9 | **El `beforeLoad` de `/restablecer-contrasena` deja pasar la navegación de inmediato.** La espera del evento `PASSWORD_RECOVERY` ocurre en el contenedor `RestablecerContrasena` con estado `'esperando'`, NO en el guard. | Evita pantalla congelada 5s y elimina la race condition con el procesamiento del fragmento URL que Supabase hace al cargar el bundle. |
| 10 | **El contenedor `RestablecerContrasena` se suscribe a `supabase.auth.onAuthStateChange` mediante `useEffect`** y devuelve `data.subscription.unsubscribe()` en el cleanup. | Este `useEffect` es de **suscripción a un store externo** (event emitter de Supabase), no de sincronización de estado local con datos de SWR. **No viola** la regla "Zero-Indulgence en React: Estado Derivado vs Efectos" de `SKILLS.md`. |
| 11 | **Zod valida la fortaleza mínima de la contraseña** (`usePoliticaContrasena`) en el cliente, además del feedback visual del `IndicadorFortalezaContrasena`. | Cumple `REGLA-ZOD-SCHEMA-BRIDGE`: el esquema debe rechazar contraseñas débiles antes de consumir red. Supabase sigue siendo la última línea de defensa. |
| 12 | **Estado de éxito NO se distingue del estado de "correo no registrado"** en `RecuperarContrasena`. | Anti-enumeración (decisión #3). El componente siempre muestra el mismo mensaje neutro cuando `exito !== null`. |
| 13 | **Multi-dispositivo:** se documenta y prueba explícitamente el caso "el cuidador solicita desde PC y abre el enlace desde el móvil". | Gotcha conocido de Supabase PKCE: el `code_verifier` se guarda en `localStorage` del navegador emisor. Si la recuperación se inicia en un dispositivo y se consume en otro, el intercambio puede fallar. Se documenta como caso límite conocido y se sugiere ventana privada como workaround de prueba. |

---

## 1. Contexto y motivación

Un cuidador que olvidó su contraseña no tiene hoy forma de recuperarla desde la aplicación: no existe enlace "¿Olvidaste tu contraseña?" en `InicioSesion` ni vista de recuperación. Esto obliga a contactar al `AdministradorSistema` para una intervención manual, lo cual:

- Aumenta la carga operativa del admin en un sistema de salud donde la inmediatez es crítica.
- Rompe el principio de autoservicio del IdP.
- Confunde al cuidador sobre si debe crear una cuenta nueva.

Este spec añade dos vistas para cerrar el ciclo de recuperación **sin tocar el backend**, aprovechando el flujo nativo de Supabase Auth (`resetPasswordForEmail` + `updateUser`).

---

## 2. Modelo de Datos

**Sin migraciones nuevas.** Supabase Auth mantiene su tabla interna `auth.users` y los tokens de recuperación (`recovery_token`) en `auth.refresh_tokens`. La BD local `Usuarios` no se modifica.

---

## 3. Backend

**No hay cambios en backend.** El flujo se orquesta exclusivamente desde el cliente con métodos del SDK público de Supabase:

| SDK Call | Endpoint interno Supabase | Propósito |
|---|---|---|
| `supabase.auth.resetPasswordForEmail(correo, { redirectTo })` | `POST /auth/v1/recover` | Solicita el envío del correo con el enlace de recuperación. |
| `supabase.auth.onAuthStateChange((evento, sesion) => ...)` | n/a (cliente) | Detecta el evento `PASSWORD_RECOVERY` cuando el usuario llega desde el link. |
| `supabase.auth.updateUser({ password })` | `PUT /auth/v1/user` | Aplica la nueva contraseña tras validar la sesión de recovery. |

> **Por qué no es un endpoint FastEndpoints:** Supabase Auth ya implementa rate limiting, expiración de tokens (1h) y one-time use. Reimplementarlo duplicaría reglas y abriría superficie de seguridad innecesaria.

---

## 4. Frontend

### 4.1 Archivos nuevos

> **Convención de nombres:** el proyecto conserva `schema.ts` (decisión consciente por deuda técnica histórica; no se refactoriza en este spec).

| Archivo | Propósito |
|---|---|
| `src/views/RecuperarContrasena/RecuperarContrasena.tsx` | Contenedor: formulario con `correo`, orquesta `supabase.auth.resetPasswordForEmail`. Gestiona `exito`/`errorApi`. Bifurca Desktop/Mobile. |
| `src/views/RecuperarContrasena/RecuperarContrasenaDesktop.tsx` | Vista ≥768px. Replica layout split-screen del Login desktop. |
| `src/views/RecuperarContrasena/RecuperarContrasenaMobile.tsx` | Vista <768px. Replica layout vertical del Login mobile. |
| `src/views/RecuperarContrasena/schema.ts` | `recuperarContrasenaSchema` (solo `correo` válido). |
| `src/views/RestablecerContrasena/RestablecerContrasena.tsx` | Contenedor: máquina de estados `'esperando' \| 'listo' \| 'invalido'`. Se suscribe a `onAuthStateChange` y monta `CampoContrasena` + `IndicadorFortalezaContrasena`. Llama a `supabase.auth.updateUser`. Bifurca Desktop/Mobile. |
| `src/views/RestablecerContrasena/RestablecerContrasenaDesktop.tsx` | Vista ≥768px. |
| `src/views/RestablecerContrasena/RestablecerContrasenaMobile.tsx` | Vista <768px. |
| `src/views/RestablecerContrasena/schema.ts` | `restablecerContrasenaSchema` (nueva + confirmación, refina con la política de `usePoliticaContrasena`). |

### 4.2 Rutas nuevas (`src/routes/`)

| Archivo | Comportamiento |
|---|---|
| `recuperar-contrasena.tsx` | `createFileRoute('/recuperar-contrasena')` → `beforeLoad` consulta `supabase.auth.getSession()`; si hay sesión activa, lanza `redirect({ to: '/' })`. Renderiza `RecuperarContrasena`. |
| `restablecer-contrasena.tsx` | `createFileRoute('/restablecer-contrasena')` → `beforeLoad` deja pasar la navegación siempre. La resolución del token y la espera del evento `PASSWORD_RECOVERY` ocurre en el contenedor (decisión #9). Renderiza `RestablecerContrasena`. |

### 4.3 Cambios en archivos existentes

| Archivo | Cambio |
|---|---|
| `src/views/InicioSesion/InicioSesionDesktop.tsx` | Agregar `<Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>` debajo del campo contraseña, alineado a la derecha, `text-sm text-blue-600 hover:underline cursor-pointer`. |
| `src/views/InicioSesion/InicioSesionMobile.tsx` | Mismo link, debajo del campo contraseña. |
| `.env` y `.env.example` (frontend) | Añadir `VITE_APP_URL=http://localhost:5174` (URL base usada en `redirectTo`). |

### 4.4 Variables de entorno

| Variable | Propósito | Default |
|---|---|---|
| `VITE_APP_URL` | Base URL pública del frontend. Se usa para construir el `redirectTo` que Supabase incluye en el correo. | `window.location.origin` si no está definida. **En este proyecto es `http://localhost:5174`** (puerto fijado por `vite.config.ts → server.port`). |

### 4.5 Validación (Zod estricto, full-Stack Spanish-Only)

**`recuperarContrasenaSchema`**:

```ts
import { z } from 'zod';

export const recuperarContrasenaSchema = z.object({
  correo: z
    .string()
    .min(1, 'El correo es requerido.')
    .email('El correo no tiene un formato válido.')
});
```

**`restablecerContrasenaSchema`** (importa la política desde la SSoT para evitar redeclaración):

```ts
import { z } from 'zod';
import { LONGITUD_MINIMA, CARACTERES_REQUERIDOS } from '../../components/Seguridad/politicaContrasena';

export const restablecerContrasenaSchema = z
  .object({
    nuevaContrasena: z
      .string()
      .min(1, 'La contraseña es requerida.')
      .min(LONGITUD_MINIMA, `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`)
      .refine(
        (valor) => CARACTERES_REQUERIDOS.every((patron) => patron.test(valor)),
        'La contraseña debe cumplir la política de seguridad configurada.'
      ),
    confirmarContrasena: z.string().min(1, 'Debes confirmar la contraseña.')
  })
  .refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmarContrasena']
  });
```

> **SSoT (Single Source of Truth):** `LONGITUD_MINIMA` y `CARACTERES_REQUERIDOS` viven en `src/components/Seguridad/politicaContrasena.ts` (la misma base que `usePoliticaContrasena`). Si el negocio cambia la política (p.ej. a 10 caracteres o exigir símbolos), solo se toca ese archivo y tanto `IndicadorFortalezaContrasena`, `usePoliticaContrasena` como el esquema Zod de esta vista lo reflejan automáticamente. **Prohibido redeclarar estas constantes en este archivo.**
>
> **Política autoritativa:** la regla final la ejecuta Supabase Auth en `updateUser`. Si el panel de Supabase tiene requisitos más estrictos (longitud mayor, símbolos, etc.), su error `auth/weak-password` se mapea al mensaje humano (sección 4.6). El esquema Zod es **primera línea de defensa**; `IndicadorFortalezaContrasena` da feedback visual en tiempo real.

### 4.6 Mapeo de errores (contenedores)

**`RecuperarContrasena` (`resetPasswordForEmail`)**:

| Origen Supabase | Mensaje al usuario |
|---|---|
| `email_address_invalid` | "El correo no tiene un formato válido." |
| `over_email_send_rate_limit` | "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." |
| `network` / `fetch failed` | "No se puede contactar al servidor. Verifica tu conexión e inténtalo de nuevo." |
| Otro | Mensaje neutro genérico (igual al de éxito — anti-enumeración). |

**`RestablecerContrasena` (`updateUser`)**:

| Origen Supabase | Mensaje al usuario |
|---|---|
| `auth/weak-password` | "La contraseña es demasiado débil. Debe cumplir la política configurada." |
| `same_password` | "La nueva contraseña debe ser diferente a la actual." |
| `session_not_found` / `token_expired` | "El enlace expiró o ya fue usado. Solicita uno nuevo." |
| Otro / red | "No se pudo actualizar la contraseña. Inténtalo nuevamente." |

### 4.7 Estados de UI (Spanish-Only, sin `useEffect` de sincronización)

**`RecuperarContrasena`**:

- `exito: string | null` → cuando es `string`, se oculta el formulario y se muestra bloque verde con el mensaje neutro.
- `errorApi: string | null` → bloque rojo encima del formulario.
- `estaMutando: boolean` → controla `cargando` del `<Boton>`.

**`RestablecerContrasena` (máquina de tres estados)**:

- `estado: 'esperando' | 'listo' | 'invalido'`
  - `'esperando'`: pantalla con loader (paleta azul/celeste, mensaje "Verificando enlace de recuperación…").
  - `'listo'`: muestra formulario (nueva + confirmación + indicador de fortaleza).
  - `'invalido'`: pantalla de error con CTA a `/inicio-sesion`.
- `errorApi: string | null` → bloque rojo dentro de `'listo'`.
- `estaMutando: boolean` → controla `cargando` del `<Boton>`.

**Reglas de transición** (todas se hacen dentro de un único `useEffect` que se suscribe a `onAuthStateChange`):

```text
montaje
  ├─ ¿hay sesión activa Y la URL trae indicios de recuperación?
  │     (hash con #access_token + type=recovery, o ?code= PKCE)
  │                                          → estado = 'listo'
  ├─ ¿llega evento PASSWORD_RECOVERY?        → estado = 'listo'
  └─ timeout 5s sin evento                   → estado = 'invalido'
```

> **Guard explícito contra sesión ajena a recuperación:** la transición "sesión activa → 'listo'" SOLO aplica si la URL trae indicios de recuperación (`#access_token=...&type=recovery` en el hash, o `?code=...` en el query para flujo PKCE). Un cuidador que ya tiene sesión iniciada normalmente y escribe `/restablecer-contrasena` en la barra del navegador por error NO debe entrar a la pantalla de cambio de contraseña sin haber solicitado el enlace. La detección se hace con `window.location.hash.includes('access_token')` + `new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'`.
>
> **Importante:** este `useEffect` es de **suscripción a un store externo** (event emitter de Supabase), no de sincronización de estado local con SWR. Cumple la regla "Estado Derivado vs Efectos" porque la transición entre estados deriva de un evento externo, no de un fetch cuyo resultado debamos copiar a `useState`.

### 4.8 UX y Microinteracciones

- **Cursor**: aplicado por construcción en `<Boton>` (`cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`) y `<CampoContrasena>`.
- **Mostrar/ocultar contraseña**: reusando el toggle ya existente en `CampoContrasena`.
- **Indicador de fortaleza**: `IndicadorFortalezaContrasena` debajo del campo, con feedback en tiempo real (aprovecha `usePoliticaContrasena`).
- **Paleta**: gradientes azul/celeste/blanco, consistentes con el resto de la app.
- **Accesibilidad**: `aria-label` en el link "Volver al inicio de sesión" y en el toggle de visibilidad. `aria-busy` en el `<Boton>` durante la mutación. `role="status"` en el loader del estado `'esperando'`.
- **Regresar a `/inicio-sesion`**: link visible en `RecuperarContrasena` y en la pantalla `'invalido'` de `RestablecerContrasena`.

### 4.9 Flujo end-to-end

```text
[Usuario en /inicio-sesion]
      │
      │ click "¿Olvidaste tu contraseña?"
      ▼
[/recuperar-contrasena]
      │
      │ escribe correo → supabase.auth.resetPasswordForEmail(correo, { redirectTo })
      │ (Supabase envía correo vía SMTP configurado, p.ej. Brevo)
      ▼
[bandeja de correo del usuario]
      │
      │ click en el enlace → ${VITE_APP_URL}/restablecer-contrasena#access_token=...&type=recovery
      ▼
[/restablecer-contrasena]   (beforeLoad deja pasar; no bloquea)
      │
      │ contenedor monta estado = 'esperando' (loader)
      │ onAuthStateChange detecta PASSWORD_RECOVERY → estado = 'listo'
      ▼
[formulario: nueva contraseña + confirmación + indicador de fortaleza]
      │
      │ submit → supabase.auth.updateUser({ password: nuevaContrasena })
      │ OK → navigate({ to: '/' })
      ▼
[/] (panel principal) — sesión activa, dentro de la app
```

> **Decisión clave (vs v1):** en v1 se redirigía a `/inicio-sesion`, lo que provocaba rebote porque Supabase deja al usuario con sesión autenticada tras `updateUser` y los `beforeLoad` lo redirigirían de vuelta a `/`. En v2, tras éxito, se navega directo a `/` (panel principal).

---

## 5. Pruebas y verificación

### 5.1 Camino feliz

1. Levantar backend (`dotnet run`) y frontend (`npm run dev`).
2. Crear un usuario de prueba vía invitación.
3. Ir a `/inicio-sesion` → click "¿Olvidaste tu contraseña?".
4. Escribir correo válido → ver mensaje neutro.
5. Revisar bandeja → abrir el enlace → caer en `/restablecer-contrasena`.
6. Estado `'esperando'` aparece brevemente → cambia a `'listo'` con el formulario visible.
7. Escribir contraseña que cumpla la política → ver indicador verde.
8. Submit → ver mensaje de éxito → redirigir directo a `/` (panel principal), sin pasar por login.

### 5.2 Edge cases

| Caso | Resultado esperado |
|---|---|
| Correo no registrado | Mismo mensaje neutro que correo registrado (no enumeración). |
| Link expirado (>1h) | Pantalla "El enlace es inválido o expiró" con CTA a `/inicio-sesion`. |
| Link usado dos veces | Segunda vez falla con error de sesión, mismo mensaje de enlace inválido. |
| Solicitar recuperación >5 veces en 1h | Supabase devuelve `over_email_send_rate_limit`, frontend muestra mensaje humano. |
| Doble clic rápido en submit | `<Boton>` deshabilita durante `estaMutando=true`, previene doble envío. |
| Sesión activa navegando a `/recuperar-contrasena` | `beforeLoad` redirige a `/`. |
| `VITE_APP_URL` no configurada | Fallback a `window.location.origin`. |
| Contraseña débil (no cumple Zod) | `IndicadorFortalezaContrasena` lo refleja y el esquema Zod bloquea el submit sin enviar a Supabase. |
| Contraseña cumple Zod pero no la política del panel Supabase | Supabase devuelve `auth/weak-password`, frontend muestra "La contraseña es demasiado débil…". |
| **Multi-dispositivo (PC → móvil):** el cuidador solicita la recuperación en Chrome del PC y abre el enlace desde el navegador del teléfono | Comportamiento esperado: el intercambio PKCE puede fallar porque `code_verifier` está en `localStorage` del PC. Estado pasa a `'invalido'`. **Workaround documentado:** abrir el enlace en el mismo dispositivo/nave donde se solicitó, o usar una ventana privada en el destino. |
| **Multi-dispositivo (PC → ventana privada del mismo PC):** | Comportamiento esperado: mismo comportamiento que arriba (privada tiene `localStorage` aislado). Documentado como caso límite conocido de Supabase PKCE. |
| Navegación a `/restablecer-contrasena` sin venir de un enlace | `onAuthStateChange` no emite `PASSWORD_RECOVERY`, timeout 5s, estado = `'invalido'`. |
| Cuidador con sesión activa navega manualmente a `/restablecer-contrasena` (sin enlace en la URL) | El guard detecta que no hay indicios de recuperación en `window.location.hash`; `onAuthStateChange` no emite `PASSWORD_RECOVERY`; tras 5s, estado = `'invalido'`. **No se monta el formulario aunque haya sesión.** |

---

## 6. Qué NO hace este spec

- No introduce envío directo de correos vía Resend SDK (se mantiene SMTP de Supabase).
- No añade endpoints en backend.
- No toca `AppDbContext`, migraciones ni `routeTree.gen.ts` a mano.
- No modifica la plantilla de invitación (esa se edita en el panel de Supabase; cuando el usuario pase la plantilla de recuperación, se documenta en este spec como anexo).
- No refactoriza `schema.ts` → `esquema.ts` (deuda técnica histórica; decisión fuera de alcance).

---

## 7. Anexo — Plantilla del correo de recuperación

La plantilla del correo la envía **Supabase Auth** con el SMTP configurado en su panel. El frontend NO compone ni envía el HTML; Supabase sustituye los placeholders antes del envío.

### 8.1 Dónde configurarla

`Supabase Dashboard → Authentication → Email Templates → Reset Password`

Campos a editar:

| Campo | Valor |
|---|---|
| **Subject** | `Restablece tu contraseña en RACPD` |
| **Body** | Pegar el HTML de la sección 7.2 |

### 7.2 Plantilla HTML

Mantiene **100% de consistencia visual** con la plantilla de invitación (mismas paleta azul/celeste, misma estructura, mismas esquinas redondeadas, mismo footer automático). Solo cambian tres piezas de copy:

- Subject: `Invitación a RACPD` → `Restablece tu contraseña en RACPD`.
- H1 del header: `Bienvenido a RACPD` → `Restablece tu contraseña`.
- Texto del botón: `Activar mi cuenta` → `Restablecer mi contraseña`.
- Párrafo aclaratorio final añadido: *"Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña actual seguirá siendo válida."* (importante para que el cuidador que recibe el correo sin haberlo solicitado sepa que no debe preocuparse).

El HTML completo está versionado en el repositorio en [`docs/templates/recuperar-contrasena.html`](../../templates/recuperar-contrasena.html) para no perderlo entre iteraciones.

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablece tu contraseña en RACPD</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EFF6FF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; background-color: #EFF6FF; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
                    <tr>
                        <td style="background-color: #2563EB; padding: 30px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Restablece tu contraseña</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #1E3A8A; line-height: 1.6;">
                                Hola,
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 16px; color: #1E3A8A; line-height: 1.6;">
                                Recibimos una solicitud para restablecer la contraseña de tu cuenta en la <strong>Red de Apoyo para Cuidadores de Personas con Dependencia (RACPD)</strong>.
                                Para definir una nueva contraseña de acceso, haz clic en el siguiente botón:
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px 0;">
                                        <a href="{{ .ConfirmationURL }}" style="background-color: #2563EB; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">Restablecer mi contraseña</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #60A5FA; line-height: 1.5;">
                                Si el botón no funciona, copia y pega este enlace en tu navegador:
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #2563EB; word-break: break-all;">
                                {{ .ConfirmationURL }}
                            </p>
                            <p style="margin: 24px 0 0 0; font-size: 14px; color: #60A5FA; line-height: 1.5;">
                                Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña actual seguirá siendo válida.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #DBEAFE; padding: 20px 40px; text-align: center; border-top: 1px solid #BFDBFE;">
                            <p style="margin: 0; font-size: 13px; color: #1E3A8A;">
                                Este es un mensaje automático generado por RACPD. Por favor, no respondas a este correo.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

### 7.3 Placeholders soportados

Supabase sustituye automáticamente:

| Placeholder | Significado |
|---|---|
| `{{ .ConfirmationURL }}` | URL completa del enlace de recuperación (apunta a `${VITE_APP_URL}/restablecer-contrasena#access_token=...&type=recovery`). |

### 7.4 Cómo verificar que quedó bien

1. Levantar frontend y backend en local.
2. Asegurarse de que `VITE_APP_URL` apunte a `http://localhost:5174` en el `.env` del frontend.
3. Ir a `/inicio-sesion` → "¿Olvidaste tu contraseña?" → escribir un correo real de prueba.
4. Revisar la bandeja del correo: el botón "Restablecer mi contraseña" debe verse azul, redondeado, con el mismo estilo que el de la invitación.
5. Click en el botón → debe caer en `${VITE_APP_URL}/restablecer-contrasena` y mostrar el formulario (estado `'listo'`).
6. (Importante) Si la URL llega sin fragmento o con un dominio distinto al esperado, revisar `VITE_APP_URL`.

### 7.5 Notas de seguridad reflejadas en la plantilla

- La plantilla **no menciona el correo del destinatario** en el cuerpo (Supabase ya lo gestiona en el header `To:`). Esto evita exposición accidental si alguien reenvía el mensaje.
- El copy final *"Si no solicitaste este cambio, puedes ignorar este mensaje"* es una salvaguarda explícita contra phishing.
- La expiración del enlace la gestiona Supabase (1 hora por defecto). No se documenta en la plantilla para evitar rigidez, pero puede añadirse si el negocio lo considera necesario.

---

## 8. Configuración obligatoria en el dashboard de Supabase

Para que Supabase Auth permita el flujo de recuperación (y el de invitación que ya existía) sin rechazar el redirect, **es obligatorio** registrar las URLs permitidas en el panel. Sin esto, Supabase responde `redirect_uri not allowed` aunque el `redirectTo` enviado desde el frontend sea correcto.

### 8.1 Dónde

`Supabase Dashboard → Authentication → URL Configuration`

### 8.2 Site URL

Es la URL base "canónica" del frontend. Supabase la usa como destino por defecto cuando no se especifica `redirectTo`.

| Entorno | Site URL |
|---|---|
| Desarrollo local | `http://localhost:5174` |
| Producción | URL pública definitiva (ej. `https://app.racpd.example.com`) |

### 8.3 Redirect URLs (lista blanca)

Es la lista explícita de URLs a las que Supabase **sí** redirigirá tras un flujo OAuth, recuperación o invitación. Si el `redirectTo` enviado desde el frontend NO está aquí, el flujo falla.

Para RACPD se requieren **al menos**:

| URL | Por qué |
|---|---|
| `http://localhost:5174/inicio-sesion` | Destino tras invitación (es el `redirect_to` que `InvitarEndpoint` envía a `POST /auth/v1/invite`). |
| `http://localhost:5174/restablecer-contrasena` | Destino tras recuperación (es el `redirectTo` que `RecuperarContrasena` envía a `resetPasswordForEmail`). |
| `http://localhost:5174/**` | Wildcard (opcional pero recomendado en desarrollo) que cubre cualquier ruta del frontend, útil para evitar fricciones durante el desarrollo. |

En **producción**, cada URL debe aparecer explícitamente sin wildcard, por seguridad:

| URL | Entorno |
|---|---|
| `https://app.racpd.example.com/inicio-sesion` | Producción |
| `https://app.racpd.example.com/restablecer-contrasena` | Producción |

### 8.4 Por qué importa

Si el `redirectTo` no está en la lista blanca:

- Supabase devuelve un error `redirect_uri not allowed` (HTTP 400) al llamar a `resetPasswordForEmail` o a `POST /auth/v1/invite`.
- El frontend lo recibe y muestra el mensaje genérico `setExito(MENSAJE_EXITO_NEUTRO)` en `RecuperarContrasena` (anti-enumeración), por lo que el cuidador **cree** que el correo se envió pero nunca llega.
- En `InvitarEndpoint`, el backend loguea el warning pero igualmente crea la fila local en `PendienteAceptacion`, dejando al invitado en un limbo.

### 8.5 Cómo verificar

1. Backend corriendo con `dotnet run` y frontend con `npm run dev`.
2. En el dashboard de Supabase, abrir `Authentication → URL Configuration`.
3. Confirmar que `Site URL` = `http://localhost:5174`.
4. Confirmar que **existen** al menos las tres URLs listadas arriba en `Redirect URLs`.
5. Disparar un `resetPasswordForEmail` desde el navegador con DevTools abierto → no debe haber `redirect_uri not allowed` en la consola ni en la pestaña Network.
6. Revisar la bandeja del correo de prueba: el botón "Restablecer mi contraseña" debe apuntar a `http://localhost:5174/restablecer-contrasena#access_token=...&type=recovery`.

---

## 9. Changelog

- **v6 (cierre):** flujo probado end-to-end con éxito por el usuario. Spec aprobado y cerrado. Pendiente solo el commit (a cargo del usuario).
- **v5 (bugfix backend):** el bug del `redirect_to=http://localhost:3000/inicio-sesion` hardcodeado en `RACPD.Backend/Features/Usuarios/Invitar/InvitarEndpoint.cs:243` ya fue corregido. El endpoint lee `RACPD_FRONTEND_URL_BASE` desde configuración (con `Trim('"')` y `TrimEnd('/')` para tolerar comillas y barras finales), con fallback seguro a `http://localhost:5174`. El `redirect_to` se construye con `Uri.EscapeDataString` para evitar problemas con caracteres especiales en la query string. La variable está documentada en `RACPD.Backend/.env.example`. `dotnet build` pasa con 0 errores y 0 advertencias.
- **v4 (corrección de puerto + config Supabase):**
  - `.env.example`: `VITE_APP_URL` corregido de `http://localhost:3000` a `http://localhost:5174` (puerto real definido en `vite.config.ts → server.port`).
  - Sección 8 nueva: **Configuración obligatoria en el dashboard de Supabase** (Site URL + Redirect URLs). Sin esto, Supabase rechaza los redirects y el correo nunca llega aunque el frontend diga que sí.
  - Tabla 4.4: default de `VITE_APP_URL` aclarado con el puerto real del proyecto.
  - Reorden de secciones: Anexo de plantilla ahora es 7, Configuración Supabase es 8.
- **Nota técnica (corregido en v5):** el bug del `redirect_to=http://localhost:3000/inicio-sesion` hardcodeado en `RACPD.Backend/Features/Usuarios/Invitar/InvitarEndpoint.cs:243` ya fue corregido. Ahora el endpoint lee `RACPD_FRONTEND_URL_BASE` desde configuración (con `Trim('"')` y `TrimEnd('/')` para tolerar comillas y barras finales), con fallback seguro a `http://localhost:5174`. El `redirect_to` se construye con `Uri.EscapeDataString` para evitar problemas con caracteres especiales en la query string. La variable está documentada en `RACPD.Backend/.env.example` y, para producción, basta con setear `RACPD_FRONTEND_URL_BASE=https://app.racpd.example.com` sin tocar código. `dotnet build` pasa con 0 errores y 0 advertencias.
- **v3 (post ajustes menores):**
  - Bugfix #1: `<a href>` reemplazado por `<Link>` en la pantalla `'invalido'` de `RestablecerContrasena` → evita hard refresh, mantiene navegación SPA.
  - Bugfix #2: eliminada línea duplicada `mensaje.includes('expired')` en `mapearErrorRestablecimiento`.
  - Sección 8 nueva: Anexo con la plantilla HTML del correo de recuperación (versionada en `docs/templates/recuperar-contrasena.html`), espejo de la plantilla de invitación. Incluye dónde configurarla, placeholders, checklist de verificación y notas de seguridad.
  - HTML de la plantilla guardado también en `docs/templates/recuperar-contrasena.html` para trazabilidad (no se pierde entre iteraciones del dashboard de Supabase).
- **v2 (post code-review):**
  - Decisión #8: tras `updateUser` se redirige a `/` (no a `/inicio-sesion`) para evitar rebote con `beforeLoad`.
  - Decisión #9: la espera del evento `PASSWORD_RECOVERY` se mueve del `beforeLoad` al contenedor, eliminando pantalla congelada y race condition.
  - Decisión #10: se aclara que el `useEffect` de `onAuthStateChange` es de suscripción a store externo y NO viola la regla "Estado Derivado vs Efectos".
  - Decisión #11: Zod valida fortaleza mínima (longitud + mayúscula + dígito) además del feedback visual.
  - Decisión #13: caso multi-dispositivo / ventana privada documentado en edge cases.
  - Sección 4.7: estados renombrados a español (`errorApi`, `estaMutando`).
  - Sección 4.1: nota explícita sobre convención `schema.ts` (no refactor).
- **v1:** borrador inicial.
