# 💙 RACPD - Red de Apoyo para Cuidadores de Personas con Dependencia

**RACPD** es una plataforma web y PWA de alta fiabilidad diseñada para coordinar, apoyar y optimizar la gestión diaria de cuidadores de personas con dependencia (agenda compartida de turnos/relevos, bitácora de eventos, recordatorios de medicamentos y alertas SOS).

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

### 🎨 Frontend (`RACPD.Frontend`)
- **Framework & Bundler:** React 19 + Vite + TypeScript.
- **Estilos & UI:** Tailwind CSS v4 (Paleta basada en tonos azules, celestes y blancos para brindar calma y accesibilidad).
- **Enrutamiento:** TanStack Router.
- **Estado y Data Fetching:** SWR (*Zero-Wait Policy* mediante UI Optimista y cache reactivo).
- **Generación de Contratos HTTP:** **Orval** (Genera hooks SWR y tipos TypeScript automáticamente desde el `swagger.json` del Backend).
- **Formularios & Validaciones:** React Hook Form + Zod (*Zero-Indulgence Type Bridge*).
- **Arquitectura de Vistas:** *Dual Views Pattern* (`[Feature]Desktop.tsx` y `[Feature]Mobile.tsx`).

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
│   ├── Features/             # Vertical Slices (EndPoints, DTOs, Validaciones por Feature)
│   ├── Migrations/           # Migraciones EF Core
│   └── Program.cs            # Configuración de servicios y middlewares
├── RACPD.Frontend/           # Frontend React 19 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/              # Cliente autogenerado (Orval) y customFetch mutator
│   │   ├── components/       # Componentes UI agnósticos
│   │   ├── views/            # Vistas bimodal (Desktop / Mobile) y flujo de pantalla
│   │   └── main.tsx          # Punto de entrada React
│   ├── orval.config.ts       # Configuración del generador de API Orval
│   └── package.json
├── docs/                     # Documentación técnica y especificaciones del proyecto
├── AGENTS.md                 # Misión, roles y embudo de planificación para Agentes IA
├── SKILLS.md                 # Contexto técnico y Reglas Maestras de desarrollo
└── README.md                 # Documentación principal del repositorio
```
