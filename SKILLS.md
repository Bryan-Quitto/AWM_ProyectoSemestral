# CONTEXTO TÉCNICO Y REGLAS MAESTRAS
Asume estrictamente el siguiente entorno para cualquier código propuesto en "RACPD":

- **Stack Core:** .NET 10 (C#) con EF Core y FastEndpoints en el Backend. React 19 (Vite) con Tailwind CSS en el Frontend. PWA configurada.
- **Base de Datos:** Supabase (PostgreSQL). Migraciones exclusivas por CLI de EF Core.
- **Arquitectura Backend (Vertical Slice):** Cero MVC/Clean Architecture. Uso obligatorio de FastEndpoints para organizar cada caso de uso (Ruta, Validación y Manejador en un solo archivo). Todo agrupado por Feature (<200 líneas). Uso obligatorio del "One Trip Pattern" para consultas pesadas.
- **Idioma del Proyecto (Full-Stack Spanish-Only Rule):** NADA de inglés en todo el proyecto. Base de código, DTOs, Enums, Migraciones y UI deben estar estrictamente en ESPAÑOL.
- **UI/UX y Paleta de Colores:** Uso estricto de tonos claros. La interfaz debe construirse sobre gradientes y paletas de azul, celeste y blanco, alineándose con la psicología de aplicaciones de salud y tranquilidad.

### 🌐 Contratos de API (Strict SSoT & OpenAPI)
- El Backend es la Única Fuente de Verdad. Todo endpoint de FastEndpoints debe documentarse para Swagger.
- **PROHIBIDO** el uso de objetos anónimos. Todo retorno debe ser un Record/DTO explícito.
- Los **Enums** (ej. Roles: Cuidador Principal, Apoyo) deben existir en C#, usar `.HasConversion<string>()` y exponerse como strings.
- **GOTCHA (Error CS1736):** Prohibido inicializar colecciones en records posicionales con `[]`. El Frontend asumirá los fallbacks defensivos (`?? []`).

### 🚨 REGLA-RFC-7807-ERRORS (Zero-Indulgence Error Handling)
ESTRICTAMENTE PROHIBIDO devolver errores HTTP como texto plano o cuerpos vacíos.
- Toda respuesta de error DEBE cumplir con el estándar **RFC 7807 (ProblemDetails)**.
- Para errores de validación, asegurar que el campo `Detail` esté poblado para que el Frontend tenga un string válido que mostrar.

### 🔐 REGLA-AUTH-JWKS (Asymmetric Auth)
- La validación de JWT se hace EXCLUSIVAMENTE vía JWKS (RS256) usando el `.well-known` de Supabase. Prohibido requerir variables como `JWT_SECRET`.

### 🖥️ Frontend y Red (Orval-Only & Patrón Mapper)
- Todo consumo HTTP debe hacerse mediante los hooks autogenerados por Orval vía `fetch` nativo y SWR.
- **Generación de Contratos:** Para hidratar `src/api/generated`, asegúrate de que el Backend esté corriendo (para que exponga Swagger) y ejecuta `npm run api:generate` en el Frontend.
- **PROHIBIDO** modificar los archivos generados por Orval. Usa el flujo automatizado para actualizar.
- **ZERO-INDULGENCE EN TIPOS:** Prohibidas las aserciones destructivas (`as any`). Usa el Patrón Mapper (`mappers.ts`) si la UI necesita un formato distinto al DTO.

### ⚛️ Zero-Indulgence en React (Estado Derivado vs Efectos)
- PROHIBIDO usar `useEffect` para sincronizar datos de SWR con estado local. Usa el patrón de **Estado Derivado**.
- **Arquitectura Dual Views:** Toda UI debe bifurcarse en `[Nombre]Desktop.tsx` y `[Nombre]Mobile.tsx` en la subcarpeta `/views/`.

### 🛡️ REGLA-ZOD-SCHEMA-BRIDGE & REGLA-TS-ESTRICTO (Día Cero)
Estas reglas de compilación estricta (TS/ESLint) deben configurarse e imponerse desde la inicialización del repositorio.
- Todo formulario usa exclusivamente el inferido de Zod: `useForm<z.infer<typeof miSchema>>`.
- Prohibidas aserciones ciegas (`as T`), Non-Null Assertions (`!`) y uso de `any`.
- Uso obligatorio de **Type Guards** reutilizables para evaluar datos en runtime.

### 🚨 REGLA-EF-CONSULTAS-SEGURAS (Zero-Indulgence)
- Evitar el bug de Npgsql 10 con `SplitQuery`.
- Prohibido más de una invocación a `FirstOrDefault(...)` dentro de un `.Select(...)`.
- Refactorizar a **LATERAL JOIN único** o **Two-Query Pattern** (Diccionarios en memoria).
- Ejemplo: Al cargar la Agenda Compartida de Turnos, no anides consultas complejas en el Select.

### 🚀 REGLA-EF-OUTBOX-PATTERN (Notificaciones Vitales)
- Para procesar las notificaciones push de recordatorios críticos mediante Background Jobs, PROHIBIDO hacer `Take(100)` con LINQ estándar.
- Usa SQL Crudo, IExecutionStrategy y Transacciones: `SELECT * FROM "Outbox" ORDER BY "Fecha" LIMIT X FOR UPDATE SKIP LOCKED`.

### 🙈 REGLA-EF-BACKGROUND-JOBS-FILTERS (Zero-Indulgence System Blindness)
- En Background Jobs, es OBLIGATORIO usar `.ParaJob()` (que encapsula `.IgnoreQueryFilters()`) en consultas LINQ para evitar bloqueos por falta de un usuario logueado en el contexto.

### 🏢 REGLAS DE NEGOCIO Y DOMINIO
1. **Huso Horario Estricto:** Operar bajo `America/Guayaquil`. Crítico para la sincronización de la Agenda Compartida.
2. **Evidencia Fotográfica:** La captura de evidencia en la Bitácora (recetas, heridas) no se guarda en Base64. Se persiste mediante Object Storage devolviendo la URL.
3. **Optimistic UI:** Acciones como asignarse voluntariamente a un turno de relevo deben reflejarse instantáneamente en UI.