# 💙 RACPD - Red de Apoyo para Cuidadores de Personas con Dependencia

**RACPD** es una plataforma web y PWA de alta fiabilidad diseñada para coordinar, apoyar y optimizar la gestión diaria de cuidadores de personas con dependencia.

> ⚠️ **Estado del Proyecto:** En desarrollo activo. La funcionalidad de Agenda de Turnos está implementada y operativa.

---

## ✅ Funcionalidades Implementadas

### 1. Gestión de Usuarios y Roles
- [x] Creación de cuentas con roles definidos (Administrador, Cuidador Principal, Apoyo)
- [x] Autenticación JWT via Supabase (RS256 + JWKS)
- [x] Configuración de perfil (nombre, apellido)
- [x] Modificación de contraseña con política de seguridad

### 2. Agenda Compartida de Turnos *(✨ Nuevo - Implementado)*
- [x] **Backend:** 6 endpoints FastEndpoints con validaciones RFC 7807
  - `GET /api/agenda` — Listar bloques de turnos
  - `GET /api/agenda/{id}` — Obtener detalle de bloque
  - `POST /api/agenda` — Crear bloque (solo Cuidador Principal)
  - `PUT /api/agenda/{id}` — Editar bloque (solo creador)
  - `DELETE /api/agenda/{id}` — Eliminar bloque (con validación de reservas)
  - `POST /api/agenda/{id}/reservar` — Reservar turno
  - `DELETE /api/agenda/{id}/reserva` — Cancelar reserva
- [x] **Entidades:** `BloqueTurno`, `ReservaTurno` con control de concurrencia
- [x] **Frontend:** Dual Views (Desktop grid 3 columnas / Mobile lista vertical) + Calendario visual mensual
- [x] **Validaciones:**
  - R1: Solo Cuidador Principal puede crear/editar bloques
  - R2: No reservar propio bloque
  - R3: No bloques en fechas pasadas
  - R4: Cupos entre 1-5
  - R5: No doble reserva
  - R6: Control de cupos máximos
- [x] **UX:** Microinteracciones, toasts, estados visuales diferenciados

### 3. Control de Tareas Diarias
- [ ] Pendiente de implementación

### 4. Directorio Verificado de Relevos
- [ ] Pendiente de implementación

### 5. Bitácora de Novedades (Traspaso de turno)
- [ ] Pendiente de implementación

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
| `npm run api:generate` | Ejecuta **Orval** para sincronizar contratos API (`src/api/generated`). Requiere Backend encendido. |
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
│   │   └── Entities/         # BloqueTurno.cs, ReservaTurno.cs, Usuario.cs
│   ├── Features/             # Vertical Slices
│   │   ├── Agenda/           # Agenda de Turnos (6 endpoints)
│   │   ├── Identidad/        # Autenticación
│   │   └── Usuarios/         # Gestión de usuarios
│   ├── Migrations/           # Migraciones EF Core (incluye AddAgendaTables)
│   └── Program.cs            # Configuración de servicios y middlewares
├── RACPD.Frontend/           # Frontend React 19 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/              # Cliente autogenerado (Orval)
│   │   ├── components/       # Componentes UI agnósticos
│   │   ├── views/            # Vistas bimodal (Desktop / Mobile)
│   │   │   └── Agenda/      # AgendaDesktop, AgendaMobile, TarjetaBloque, DialogoBloque
│   │   ├── features/        # Hooks y lógica por feature
│   │   │   └── agenda/      # useAgenda.ts, useCrearBloque.ts, etc.
│   │   └── routes/          # Rutas TanStack Router
│   ├── orval.config.ts       # Configuración del generador de API Orval
│   └── package.json
├── docs/                     # Documentación técnica y especificaciones
│   └── spec-agenda-turnos.md # Especificación de la Agenda de Turnos
├── AGENTS.md                 # Misión, roles y embudo de planificación para Agentes IA
├── SKILLS.md                 # Contexto técnico y Reglas Maestras de desarrollo
└── README.md                 # Documentación principal del repositorio
```
