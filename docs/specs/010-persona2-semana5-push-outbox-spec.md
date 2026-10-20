# Especificación de notificaciones push y procesamiento Outbox

Estado: diseño aprobado por el usuario e implementación completada; validación en dispositivos pendiente. Fecha: 2026-10-20, America/Guayaquil.
Responsable funcional: Persona 2, semana 5. Complejidad alta, desarrollo guiado por especificación.

## 1. Objetivo y decisión aprobada

Al cerrar un turno con EstadoAnimoTurno.Mal o EstadoAnimoTurno.MuyMal, registrar el evento BITACORA_ANIMO_CRITICO en la misma transacción de la bitácora y despachar una notificación al Cuidador Principal y a todos los Apoyos con vínculo activo al dependiente. Esta selección de destinatarios fue confirmada por el usuario. Incluye al autor si cumple el vínculo y tiene suscripción activa; no se introduce una exclusión implícita.

La autorización se determina con VinculoDependiente.RolEnDependiente y Activo, no únicamente con Rol global. Se envía a todas las suscripciones activas de cada destinatario, sin duplicar una misma combinación de mensaje y suscripción. Antes de cada envío se vuelve a comprobar el vínculo; un vínculo revocado deja de autorizar envíos pendientes.

El alcance comprende VAPID, suscripciones, servicio de envío, worker nativo, recepción en Service Worker y controles en configuración. El botón SOS y su evento corresponden a Persona 3. Este módulo deja una base utilizable por esa fase, sin implementar ni consumir eventos SOS todavía.

## 2. Evidencia del repositorio y contratos existentes

- OutboxMensaje ya contiene Id, Tipo, PayloadJson, Fecha, Procesado, Intentos y Fallo. El DbSet y la tabla se denominan OutboxMensajes.
- CompletarTurnoEndpoint ya registra BITACORA_ANIMO_CRITICO junto a la bitácora. Su carga actual contiene bitacoraId, bloqueId, registradoPorId, estadoAnimo y fechaCierre; se conserva compatibilidad con mensajes pendientes de ese formato.
- BloqueTurno.PerfilDependienteId permite resolver el dependiente sin aceptar un identificador de destinatario proporcionado por el navegador.
- VinculoDependiente distingue RolEnDependiente.CuidadorPrincipal y RolEnDependiente.Apoyo. Rol global es un concepto independiente.
- public/sw.js ya implementa instalación, activación y navegación básica; se amplía el mismo registro.
- Se ejecutó correctamente la generación automatizada de OpenAPI y Orval durante la fase de aislamiento. En Windows se utilizó npm --script-shell=cmd.exe run api:generate por incompatibilidad del separador && con Windows PowerShell.

Nombres comprobados en src/api/generated/api/api.ts:

- RACPDBackendFeaturesAgendaCompletarCompletarTurnoRequest.
- RACPDBackendFeaturesAgendaCompletarCompletarTurnoResponse.
- rACPDBackendFeaturesAgendaCompletarCompletarTurnoEndpoint.
- useRACPDBackendFeaturesAgendaCompletarCompletarTurnoEndpoint.
- useRACPDBackendFeaturesAgendaNotificacionesResumenNotificacionesResumenEndpoint.

Los contratos de suscripción descritos más adelante son nuevos y propuestos. Sus nombres de cliente se obtendrán de Orval después de implementar los DTO y documentar los endpoints; no se inventarán ni editarán archivos generados.

## 3. Lenguaje ubicuo y experiencia

Se mantienen los términos oficiales: turno, bitácora, dependiente, Cuidador Principal y Apoyo. Suscripción significa un navegador/dispositivo autorizado; aceptación significa que el proveedor push aceptó el envío, no que el dispositivo lo mostró o que una persona lo leyó.

Texto propuesto de notificación: título «RACPD» y cuerpo «Hay una actualización importante en tu red de cuidados. Abre la aplicación para revisarla». No incluir nombres, síntomas, fotografías ni estado de ánimo en la pantalla bloqueada. La aplicación consulta el detalle tras autenticar y autorizar al usuario.

La sección «Notificaciones» en configuración permite activar o desactivar este dispositivo. Explica el alcance y distingue: no compatible, permiso pendiente, permiso bloqueado, activando, activas, desactivando y error recuperable. No solicita permisos al abrir la aplicación. Los solicita al pulsar la acción explícita; utiliza HTTPS y userVisibleOnly. Véase la documentación de [PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).

Toda acción lleva cursor-pointer; durante bloqueo, disabled:cursor-not-allowed y disabled:opacity-50. Mantener paleta azul, celeste y blanco, foco visible, etiquetas accesibles y mensajes anunciados por tecnologías de asistencia. La navegación y el cierre del turno nunca esperan al proveedor push.

## 4. Modelo de datos propuesto

Los nombres nuevos de dominio, DTO, campos y migraciones serán españoles. Los nombres impuestos por APIs web o protocolos se conservan en la frontera y se transforman con mappers.

### SuscripcionPush

Campos: Id, UsuarioId, UrlDestino, HuellaDestino, ClavePublica, SecretoAutenticacion, Activa, FechaCreacion, FechaActualizacion y Version como token de concurrencia PostgreSQL. La huella SHA-256 del destino tendrá índice único; la URL completa se conserva para enviar y se compara ante coincidencia. Un destino no se puede reasignar silenciosamente a otro usuario. Una cuenta distinta debe completar desvinculación y generar una nueva suscripción del navegador.

La creación y actualización son idempotentes para el mismo propietario y destino. Las claves no aparecen en respuestas de listado, telemetría ni errores. Los datos de suscripción se tratan como credenciales de entrega y tienen acceso restringido.

### EntregaPush

Campos: Id, OutboxMensajeId, SuscripcionPushId, Estado, Intentos, ProximoIntento, ArrendamientoHasta, TokenReclamacion, FechaAceptacion, UltimoCodigoHttp y UltimoErrorClasificado. Índice único por (OutboxMensajeId, SuscripcionPushId); índice para pendientes elegibles.

Enum EstadoEntregaPush: Pendiente, EnProceso, Aceptada, Descartada y Fallida. Persistencia con HasConversion<string>() y representación de enums como cadenas en OpenAPI. Descartada cubre suscripción inactiva o vínculo revocado; no equivale a recepción.

### Extensión de OutboxMensaje

Añadir VersionCarga, DestinatariosResueltos, FechaProcesamiento y UltimoErrorClasificado. Conservar Tipo como discriminador existente para no convertir ni invalidar eventos ajenos al módulo. La carga BITACORA_ANIMO_CRITICO se serializa mediante un record explícito, sustituyendo el objeto anónimo actual sin cambiar los nombres JSON existentes. Validar carga, referencias y estado de ánimo antes de resolver destinatarios.

El worker materializa destinatarios con los vínculos activos al procesar el evento por primera vez, y solo toma las suscripciones activas existentes en ese momento. No reproduce alertas antiguas a nuevos dispositivos o nuevos cuidadores. Si no hay destinatarios con suscripción, registra el resultado SinDestinatariosSuscritos y finaliza el evento sin fingir una entrega exitosa.

Las migraciones se generan exclusivamente con EF Core CLI. Instantes persistidos en UTC; presentación y reglas de calendario en America/Guayaquil mediante la utilidad existente del proyecto.

## 5. Backend y seguridad

FastEndpoints organizado por feature; ruta, validación y manejador juntos en archivos menores de 200 líneas. Separar lógica de transporte y procesamiento, evitando clases universales especulativas. JWT exclusivamente con JWKS RS256 de Supabase; el propietario se extrae de los claims, nunca del cuerpo enviado por el cliente.

Contratos propuestos, pendientes de implementación y generación:

| Método y ruta | Entrada y resultado |
|---|---|
| GET /api/notificaciones/configuracion | Consulta opcional idSuscripcion mediante QueryParam; respuesta explícita con Disponible, ClavePublicaVapid y SuscripcionActiva; nunca la clave privada. Requiere autenticación. |
| POST /api/notificaciones/suscribir | Solicitud con UrlDestino, ClavePublica y SecretoAutenticacion. Respuesta 200 con Id y Activa; operación idempotente del propietario. |
| DELETE /api/notificaciones/desuscribir | Solicitud con IdSuscripcion. Respuesta 200 explícita con Activa=false; idempotente para el propietario. No permite eliminar registros ajenos. |

La UI mantiene el Id de la suscripción asociado a la cuenta actual; puede recuperar ese Id repitiendo el POST idempotente si se perdió el almacenamiento local. No se expone un listado de destinos. Definir DTO explícitos para todos los retornos y documentar éxitos y errores para OpenAPI.

Errores RFC 7807 con Detail poblado: 400 datos inválidos, 401 no autenticado, 403 operación no autorizada, 409 conflicto de propiedad/concurrencia y 503 servicio no configurado. Si hubiera parámetros de consulta deberán llevar QueryParam.

Validar longitud y codificación de claves, tamaño de solicitud y URL HTTPS sin credenciales. La URL de destino es entrada no confiable: restringir proveedores mediante lista configurable de orígenes admitidos, bloquear destinos locales/privados y desactivar redirecciones del cliente de envío. Evitar SSRF y que un endpoint autenticado se convierta en un cliente HTTP arbitrario.

VAPID se genera una sola vez por entorno con una herramienta compatible con el protocolo; clave privada solo en secretos del backend, clave pública disponible al cliente y asunto de contacto configurado. No regenerar claves al iniciar. La implementación seleccionará una biblioteca Web Push mantenida tras comprobar su compatibilidad con .NET 10 y el protocolo; no construir criptografía propia mediante HttpClient. Los nombres y versiones de paquetes deberán verificarse antes de incorporarlos.

## 6. Worker y recuperación

Implementar ProcesadorOutbox como BackgroundService con PeriodicTimer, cancelación cooperativa y scope de DI por ciclo. Nombre español en lugar del nombre ilustrativo OutboxWorker del plan. No usar Hangfire.

1. Dentro de IExecutionStrategy y una transacción corta, seleccionar eventos reconocidos pendientes con SQL parametrizado sobre la tabla real OutboxMensajes: Procesado=false, Fallo=false, orden Fecha e Id, LIMIT y FOR UPDATE SKIP LOCKED. No reclamar eventos de otras features ni usar Take(100).
2. Resolver dependiente, vínculos y suscripciones con proyecciones en una consulta por conjunto cuando sea posible; si hace falta, usar Two-Query Pattern con diccionarios. Nunca repetir FirstOrDefault dentro de una proyección ni usar SplitQuery. Toda consulta LINQ ejecutada por el job usa ParaJob(); localizar o incorporar explícitamente ese helper si falta. Aun sin filtros globales, comprobar pertenencia, vínculo activo y usuario autorizado.
3. Insertar EntregaPush una sola vez por mensaje y suscripción y marcar DestinatariosResueltos en la misma transacción. Cargas antiguas se interpretan con compatibilidad explícita. Carga malformada o referencias imposibles se clasifican como fallo permanente auditable.
4. Reclamar entregas elegibles mediante SQL con FOR UPDATE SKIP LOCKED, asignando TokenReclamacion y un arrendamiento temporal, y confirmar la transacción antes de hacer llamadas externas. No mantener bloqueos de BD durante solicitudes al proveedor ni envolver envíos de red dentro de la repetición automática de IExecutionStrategy.
5. Revalidar vínculo y suscripción, enviar con tiempo máximo por solicitud y concurrencia acotada. Actualizar el resultado solo si coincide TokenReclamacion. Recuperar entregas EnProceso cuyo arrendamiento haya vencido. Ajustar el arrendamiento para superar el tiempo máximo de envío y evitar reclamaciones simultáneas normales.
6. Respuesta satisfactoria: Aceptada. HTTP 404/410: desactivar suscripción y descartar la entrega. HTTP 429: respetar Retry-After; fallos de red y 5xx: reintentar con espera exponencial y dispersión. HTTP 401/403 del proveedor: tratar como problema de configuración, avisar por telemetría y no eliminar suscripciones válidas.
7. Propuesta inicial configurable: ciclo de 5 segundos, lote de 50, concurrencia de 4, tiempo máximo de 10 segundos por envío, arrendamiento de 60 segundos y máximo de 8 intentos. Agotados los intentos, marcar Fallida y conservar evidencia para investigación. No bloquear el procesamiento de los demás destinatarios.
8. Marcar OutboxMensaje.Procesado cuando todas sus entregas sean terminales; Fallo=true si alguna agotó intentos o la carga es inválida. Registrar los resultados parciales. Un mensaje sin suscripciones termina con resultado explícito.

La garantía es procesamiento recuperable con entrega al proveedor al menos una vez. Un fallo después de enviar y antes de guardar puede ocasionar repetición. Usar el Id del mensaje como identificador estable y tag de notificación para reducir duplicados visibles; no prometer exactamente una vez ni lectura confirmada. El TTL de transporte será configurable, inicialmente una hora, evitando mostrar una alerta antigua como si fuera reciente; el evento y sus fallos permanecen auditables.

## 7. Frontend y Service Worker

- Hook de dominio useNotificacionesPush.ts en src/features/notificaciones/hooks/. Operaciones HTTP solo mediante hooks y mutadores Orval con el mecanismo de autenticación existente.
- Vistas NotificacionesDesktop.tsx y NotificacionesMobile.tsx integradas en la configuración existente; componentes de dominio permanecen en views o features. Regla de 3 antes de extraer UI reutilizable; solo UI universal en src/components/.
- Zod estricto en las fronteras de datos. Todo formulario, si se introduce, usa useForm<z.infer<typeof esquema>>. Type guards para capacidades y cargas desconocidas. Prohibidos any, aserciones ciegas y operadores de aserción no nula.
- Derivar el estado de permiso, navegador y datos SWR, sin copiar respuestas SWR a estado local con useEffect. Invalidar las claves de la cuenta al activar/desactivar y al cambiar de sesión. Mostrar feedback inmediato de operación, pero «Activas» solo tras completar el registro en backend.
- Para activar: comprobar soporte, esperar el registro existente del Service Worker, solicitar permiso por gesto explícito, reutilizar o crear la suscripción con applicationServerKey y persistirla en backend. Si falla la persistencia, mostrar recuperación y no declarar éxito.
- Para desactivar: retirar primero la asociación de backend y después ejecutar unsubscribe del navegador. Si falla alguno, explicar el estado real y permitir reintento. En cierre/cambio de cuenta, coordinar limpieza mientras existe autenticación, borrar estado de cuenta y no reasignar destinos automáticamente. Si no puede completarse por falta de red, no afirmar que la desactivación terminó.
- En public/sw.js, añadir push y notificationclick con event.waitUntil. Validar datos antes de mostrar mediante showNotification; conservar instalación y fetch existentes. Solo aceptar rutas relativas del mismo origen y una ruta interna validada; nunca navegar a URL externa de la carga.
- Al pulsar, enfocar una ventana existente o abrir la aplicación. Abrir el contexto de la bitácora utilizando una ruta comprobada durante implementación; si falta sesión, pedir autenticación y revalidar acceso. No inventar rutas ni almacenar datos clínicos en la notificación o caché del Service Worker.
- HTTPS y compatibilidad se comprueban en ejecución; en pruebas se verificarán Android y Safari iOS con la PWA instalada cuando lo requiera el dispositivo. No hay envío offline: la UI informa el estado sin bloquear la navegación.

## 8. Observabilidad y aceptación

Métricas: eventos pendientes y antigüedad, entregas aceptadas, descartadas, fallidas, reintentos y ausencia de destinatarios suscritos. Correlación por Id de mensaje y entrega; logs sin claves, URL de proveedor ni información clínica. Una aceptación del proveedor no se presenta como confirmación humana.

Pruebas necesarias durante implementación:

| Escenario | Criterio de aceptación |
|---|---|
| Cierre Mal o MuyMal | Bitácora y evento se guardan juntos; si falla la transacción, ninguno persiste. |
| Otros estados de ánimo | No se genera BITACORA_ANIMO_CRITICO. |
| Principal y varios Apoyos | Reciben todos los dispositivos activos de vínculos activos; usuarios de otro dependiente quedan excluidos. |
| Rol global distinto al del vínculo | La selección respeta RolEnDependiente. |
| Vínculo revocado o suscripción desactivada | No se envía una entrega pendiente tras la revalidación. |
| Dos workers o reinicio | Materialización única, reclamación exclusiva y recuperación del arrendamiento vencido. |
| Fallo parcial | El fallo de un dispositivo no repite las entregas ya aceptadas de los otros. |
| Aceptación seguida de caída del proceso | Reintento recuperable y tag estable; se reconoce el posible duplicado de transporte. |
| 404/410, 429 y 5xx | Baja de destino inválido, respeto de Retry-After y reintentos acotados respectivamente. |
| Autorización y SSRF | No se modifican suscripciones ajenas ni se envía a destinos internos/arbitrarios. |
| Permiso denegado, incompatibilidad o falta de red | Estado comprensible y posibilidad de continuar usando la app. |
| Cambio de cuenta en el mismo navegador | No se reasigna una suscripción anterior ni se muestran detalles clínicos de otra cuenta. |
| Clic en notificación | Enfoque/apertura de ruta interna y acceso autenticado al contexto permitido. |
| Android y Safari iOS reales | Suscripción, recepción y apertura verificadas en dispositivos, con resultados documentados. |

Ejecutar dotnet build, pruebas de integración con PostgreSQL real para bloqueos y concurrencia, npm run api:generate y npm run build (incluye lint y TypeScript). Las migraciones se prueban en una base de desarrollo. No marcar como aprobadas verificaciones todavía no ejecutadas.

## 9. Orden de implementación tras aprobación

1. Verificar compatibilidad de biblioteca Web Push, configuración VAPID y helper ParaJob.
2. Crear entidades, índices y migración EF Core; probar restricciones y concurrencia.
3. Implementar endpoints autenticados, validaciones y contratos OpenAPI.
4. Tipar la carga del evento existente e implementar materialización, reclamación y envío recuperable.
5. Regenerar Orval y usar los nombres de clientes efectivamente generados.
6. Implementar hook, controles en ambas vistas y eventos del Service Worker.
7. Ejecutar pruebas estáticas, integración y dispositivos reales; entregar resultados y límites verificados.

## 10. Referencias técnicas

- [PushManager.subscribe y requisitos de suscripción](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).
- [ServiceWorkerRegistration.showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).
- Normativa local: SKILLS.md y AGENTS.md del repositorio.

Diseño aprobado por el usuario mediante «adelante». La implementación y sus pruebas automatizadas están completadas. La guía docs/notificaciones-push.md registra la configuración necesaria, las verificaciones realizadas y el fallo preexistente del historial de migraciones. La recepción en celulares reales no se ha certificado.
