# 💙 RACPD - Red de Apoyo para Cuidadores de Personas con Dependencia

**RACPD** es una plataforma web y PWA de alta fiabilidad diseñada para coordinar, apoyar y optimizar la gestión diaria de cuidadores de personas con dependencia.

> ✅ **Estado del Proyecto:** Funcionalidades troncales implementadas al 100% (Semanas 1–6 completadas: Estabilización Dual Views, Agenda Compartida, Bitácora con Evidencias Fotográficas, Directorio de Relevos, Notificaciones Push VAPID con Outbox Nativo, Botón SOS de Emergencia y Hardening PWA).

---

## ✅ Funcionalidades Implementadas

### 1. Gestión de Usuarios, Roles y Accesibilidad
- [x] Creación e invitación de cuentas con roles definidos (`AdministradorSistema`, `CuidadorPrincipal`, `Apoyo`)
- [x] Autenticación JWT asimétrica vía Supabase (RS256 + JWKS)
- [x] Configuración de perfil, cambio de contraseña y preferencias de accesibilidad (`BotonAccesibilidadFlotante`)

### 2. Perfiles de Dependientes y Ficha Médica Crítica
- [x] CRUD completo de dependientes con concurrencia optimista (`xmin`), tipo de sangre, condiciones crónicas y alergias estructuradas
- [x] Contactos de emergencia con marcación telefónica (`tel:`) y enlace WhatsApp normalizado a código país `593` (`construirEnlaceWhatsApp.ts`)
- [x] Gestión de vínculos y permisos RBAC entre cuidadores y dependientes

### 3. Agenda Compartida de Turnos y Control de Tareas
- [x] **Backend:** Endpoints FastEndpoints con validaciones RFC 7807 y proyección de recurrencia semanal
- [x] **Reservas y Relevos:** Reserva de turnos con UI optimista, regla de antelación mínima (72h) y cancelación controlada
- [x] **Control de Tareas Diarias:** Checklist configurable por bloque de turno y registro de tareas completadas
- [x] **Frontend:** *Dual Views* (Desktop grid 3 columnas + calendario / Mobile lista vertical)

### 4. Directorio Verificado de Relevos
- [x] Listado filtrable por estado (`Disponible` / `NoDisponible`), búsqueda y dependiente
- [x] Contacto inmediato vía WhatsApp (`wa.me/593...`) y llamada telefónica (`tel:`)

### 5. Bitácora de Novedades y Evidencias Fotográficas Médicas
- [x] Cierre de turno (`POST /api/agenda/{id}/completar`) con estado de ánimo, síntomas, horas de sueño, observaciones y checklist
- [x] **Captura y Storage:** Captura de cámara en vivo / selector táctil (`capture="environment"`), validación de magic bytes, subida vía `POST /api/evidencias/subir` y servido estático bajo `/uploads/evidencias`
- [x] **Visualización:** Vista previa y acceso al original en Agenda (`TarjetaBloque`) y Dashboard (`ModalDetalleBitacoraDashboard`)

### 6. Sistema Troncal Web Push (VAPID) y Outbox Worker Nativo
- [x] **Worker Nativo .NET 10:** `ProcesadorOutbox` (`BackgroundService` + `PeriodicTimer`) ejecutando `SELECT ... FOR UPDATE SKIP LOCKED` sobre `OutboxMensajes` y `EntregasPush` (sin Hangfire)
- [x] **Envío Web Push:** Credenciales VAPID RFC 8292 (`TransportePush`), reintentos con backoff exponencial y desactivación automática ante HTTP 404/410
- [x] **Disparos Automáticos:** Encolado transaccional de `BITACORA_ANIMO_CRITICO` (ánimo `Mal` / `MuyMal`) y `ALERTA_SOS_URGENTE`
- [x] **Service Worker (`public/sw.js`):** Listeners `push` y `notificationclick` con navegación directa a la alerta correspondiente sin exponer datos clínicos en pantalla bloqueada

### 7. Botón SOS de Emergencia y Hardening PWA
- [x] **Botón SOS Móvil:** Acceso prominente en `LayoutPrincipalMobile` con modal de confirmación (`ModalConfirmacionSos`) y cuenta regresiva de 4 segundos para evitar falsos positivos
- [x] **Alerta a Red de Apoyo:** Endpoint `POST /api/alertas/sos` que notifica por Push a los cuidadores con rol `Apoyo` vinculados y abre `/sos?dependienteId=...` con datos críticos y teléfonos de auxilio
- [x] **Instalabilidad y Modo Offline:** Banner `"Instalar App RACPD"` (`beforeinstallprompt`) y caché básica de navegación offline en `sw.js`

---


---

## 🏗️ Arquitectura y Stack Tecnológico

El proyecto está construido bajo una arquitectura moderna con separación estricta de responsabilidades, tipado estricto y la estrategia de **Fuente Única de Verdad (SSoT)** mediante OpenAPI/Swagger.

### ⚙️ Backend (`RACPD.Backend`)
- **Framework:** .NET 10 (C#)
- **Patrón de Arquitectura:** FastEndpoints (Vertical Slice Architecture — Cero MVC/Clean Architecture inflada).
- **Base de Datos & ORM:** Entity Framework Core (Npgsql) sobre PostgreSQL (**Supabase**).
- **Autenticación & Autorización:** JWT asimétrico (RS256) validado exclusivamente vía JWKS (`.well-known` de Supabase).
- **Manejo de Errores:** Estándar **RFC 7807 (ProblemDetails)** obligatorio para todas las respuestas no exitosas.
- **Huso Horario:** Operativo bajo `America/Guayaquil` (Ecuador).
- **Estructura Features:** Vertical Slices bajo `Features/` (ej: `Features/Agenda/Listar/`, `Features/Agenda/Crear/`)

### 🎨 Frontend (`RACPD.Frontend`)
- **Framework & Bundler:** React 19 + Vite + TypeScript.
- **Estilos & UI:** Tailwind CSS v4 (Paleta basada en tonos azules, celestes y blancos para brindar calma y accesibilidad).
- **Enrutamiento:** TanStack Router.
- **Estado y Data Fetching:** SWR (*Zero-Wait Policy* mediante UI Optimista y cache reactivo).
- **Generación de Contratos HTTP:** **Orval** (Genera hooks SWR y tipos TypeScript automáticamente desde el `swagger.json` del Backend).
- **Formularios & Validaciones:** React Hook Form + Zod (*Zero-Indulgence Type Bridge*).
- **Arquitectura de Vistas:** *Dual Views Pattern* (`[Feature]Desktop.tsx` y `[Feature]Mobile.tsx`).
- **Estructura Agenda:**
  ```
  views/Agenda/
  ├── AgendaContenedor.tsx   # Wrapper con useMediaQuery
  ├── AgendaDesktop.tsx       # Grid 3 columnas + Calendario lateral
  ├── AgendaMobile.tsx        # Lista vertical + Calendario colapsable
  ├── CalendarioAgenda.tsx    # Componente calendario mensual
  ├── DialogoBloque.tsx       # Modal crear/editar
  ├── TarjetaBloque.tsx       # Componente visual de bloque
  └── schema.ts               # Zod schemas
  features/agenda/hooks/
  └── useAgenda.ts            # Hooks SWR (useAgenda, useCrearBloque, etc.)
  ```

---

## 🚀 Aplicar Migraciones de Base de Datos

Después de clonar el repositorio o agregar nuevas features con migraciones, ejecuta:

```bash
cd RACPD.Backend
dotnet ef database update
```

> **Nota:** Requiere que las variables de entorno estén configuradas en `.env`

---

## 📋 Prerrequisitos

Asegúrate de contar con los siguientes elementos instalados en tu sistema:
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) (Versión LTS 20 o superior recomendada)
- `npm` (incluido con Node.js)
- Instancia activa de **Supabase** (PostgreSQL)

---

## ⚙️ Configuración de Variables de Entorno

### Backend (`RACPD.Backend/.env`)
Crea un archivo `.env` en la raíz de `RACPD.Backend` con las siguientes variables:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
SUPABASE_DB_CONNECTION_STRING=Host=...;Database=...;Username=...;Password=...
```

Para habilitar el envío de notificaciones Push VAPID en desarrollo, genera las claves locales ejecutando:

```bash
cd RACPD.Backend
dotnet run -- --generar-claves-push
```

Esto crea el archivo `appsettings.Push.local.json` (ignorado por Git). En celulares reales fuera de `localhost`, asegúrate de servir la aplicación bajo **HTTPS** para habilitar Service Worker, Cámara y Push.

---

## 🚀 Guía de Inicio Rápido

Para ejecutar la aplicación localmente en tu entorno de desarrollo, sigue estos pasos:

### 1️⃣ Iniciar el Backend (.NET 10)
El backend debe iniciarse primero para exponer la especificación OpenAPI/Swagger en `http://localhost:5000/swagger/v1/swagger.json`.

```bash
cd RACPD.Backend
dotnet run
```

### 2️⃣ Iniciar el Frontend (React 19 + Vite)
En una nueva terminal, navega a la carpeta del frontend, instala dependencias, genera el cliente HTTP con Orval a partir del backend en ejecución e inicia el servidor de desarrollo Vite (puerto `3000` por defecto):

```bash
cd RACPD.Frontend
npm install
npm run api:generate
npm run dev
```

---

## 🛠️ Scripts Disponibles en Frontend

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo Vite. |
| `npm run api:generate` | Exporta automáticamente `swagger.json` desde `RACPD.Backend` y genera los contratos TypeScript/SWR con **Orval** (no requiere servidor encendido). |
| `npm run build` | Valida linter, tipos TypeScript y compila para producción. |
| `npm run lint` | Ejecuta **Oxlint** para análisis estático ultrarrápido. |
| `npm run preview` | Previsualiza el build de producción localmente. |

---

## 📐 Convenciones y Leyes Maestras del Proyecto

1. **Regla Full-Stack Spanish-Only:** Toda la base de código (entidades, DTOs, interfaces, métodos, variables y UI) está escrita en **ESPAÑOL**.
2. **Zero-Indulgence en Tipos:** Prohibidas las aserciones ciegas (`as any`), Non-Null assertions (`!`) o tipos flojos. Todo DTO se tipa mediante contratos generados por Orval o esquemas Zod.
3. **Microinteracciones UX:**
   - Todo elemento interactivo lleva `cursor-pointer`.
   - Elementos deshabilitados usan `disabled:cursor-not-allowed` y opacidad reducida (`disabled:opacity-50`).
4. **Regla de 3 (AHA UI):** No abstraer prematuramente componentes UI a menos que sean 100% agnósticos y reutilizables en `src/components/`.

---

## 📁 Estructura del Proyecto

```text
AWM_ProyectoSemestral/
├── RACPD.Backend/            # Backend .NET 10 (FastEndpoints + EF Core)
│   ├── Data/                 # AppDbContext y configuraciones EF Core
│   ├── Domain/               # Entidades y Enums de dominio
│   ├── Features/             # Vertical Slices
│   │   ├── Agenda/           # Agenda de Turnos, Reservas y Bitácora
│   │   ├── Alertas/          # Botón SOS (ALERTA_SOS_URGENTE)
│   │   ├── DirectorioRelevos/# Directorio verificado de cuidadores
│   │   ├── Evidencias/       # Subida y validación de evidencias médicas
│   │   ├── Identidad/        # Autenticación JWKS
│   │   ├── Notificaciones/   # Push VAPID + ProcesadorOutbox (SKIP LOCKED)
│   │   ├── PerfilesDependientes/ # Fichas médicas, alergias y vínculos
│   │   └── Usuarios/         # Gestión e invitación de usuarios
│   ├── Migrations/           # Migraciones EF Core
│   ├── uploads/evidencias/   # Almacenamiento estático local de evidencias
│   └── Program.cs            # Configuración de servicios, static files y middlewares
├── RACPD.Frontend/           # Frontend React 19 + Vite + Tailwind CSS + PWA
│   ├── public/sw.js          # Service Worker (caché offline + push + notificationclick)
│   ├── src/
│   │   ├── api/              # Cliente autogenerado (Orval)
│   │   ├── components/       # Componentes UI agnósticos (BannerInstalarPwa, Boton, Accesibilidad)
│   │   ├── views/            # Vistas bimodales (Desktop / Mobile)
│   │   ├── features/         # Hooks y lógica por feature (agenda, notificaciones, pwa, etc.)
│   │   └── routes/           # Rutas TanStack Router
│   ├── orval.config.ts       # Configuración del generador de API Orval
│   └── package.json
├── docs/                     # Documentación técnica, evidencias y especificaciones
├── AGENTS.md                 # Misión, roles y embudo de planificación para Agentes IA
├── SKILLS.md                 # Contexto técnico y Reglas Maestras de desarrollo
└── README.md                 # Documentación principal del repositorio
```
