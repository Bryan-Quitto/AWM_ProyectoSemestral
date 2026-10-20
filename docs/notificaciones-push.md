# Notificaciones push de Persona 2

Implementación de la semana 5 para avisar al Cuidador Principal y a todos los Apoyos con vínculo activo al dependiente cuando una bitácora registra ánimo Mal o MuyMal. La selección usa el rol del vínculo y también exige una cuenta activa. Se incluyen todos los dispositivos suscritos, incluido el del autor cuando corresponde.

## Preparación del entorno

1. Aplicar la migración AgregarNotificacionesPush sobre una base que ya tenga el esquema anterior actualizado, usando dotnet ef database update desde RACPD.Backend. La migración se generó mediante EF Core CLI. No se aplicó a Supabase durante este trabajo.
2. Generar claves una sola vez por entorno: dotnet run --no-launch-profile -- --generar-claves-push desde RACPD.Backend. Crea appsettings.Push.local.json y rechaza sobrescribir un archivo existente. El archivo está excluido de Git. Las claves de desarrollo ya se generaron en este equipo.
3. Completar NotificacionesPush.Asunto con un contacto real, por ejemplo mailto:equipo@dominio.com. Hasta completar el contacto, el servicio informa que no está disponible y el worker permanece desactivado. Reiniciar el backend tras configurar.
4. En despliegue, usar secretos de entorno NotificacionesPush__ClavePublica, NotificacionesPush__ClavePrivada y NotificacionesPush__Asunto. Nunca llevar la clave privada al frontend. Las variables de entorno prevalecen sobre el archivo local.
5. Publicar con HTTPS y abrir Configuración, Notificaciones, Activar este dispositivo. El permiso se solicita solo tras pulsar el botón.

Proveedores permitidos por defecto: fcm.googleapis.com, updates.push.services.mozilla.com y web.push.apple.com sobre HTTPS y puerto estándar. Agregar un origen adicional únicamente después de comprobar que corresponde al proveedor usado por los navegadores del equipo. El transporte bloquea redirecciones y conexiones a redes privadas.

## Funcionamiento y límites

El cierre guarda la bitácora y BITACORA_ANIMO_CRITICO en una transacción. Un worker con PeriodicTimer materializa entregas y reclama trabajos mediante FOR UPDATE SKIP LOCKED. El envío ocurre después de confirmar la transacción de reclamación. Hay arrendamientos recuperables, reintentos con espera progresiva y seguimiento por dispositivo. Los errores 404/410 desactivan destinos vencidos; 429 respeta Retry-After; los errores de VAPID se registran sin desactivar suscripciones válidas.

El evento mantiene compatibilidad con la carga JSON anterior y las filas anteriores reciben VersionCarga=1 en la migración. Los mensajes de otros tipos no se consumen. No se implementó el botón SOS de Persona 3.

La notificación es genérica, no muestra datos clínicos en la pantalla bloqueada y abre la ruta existente de agenda destacando el bloque. La consulta del contenido sigue protegida por autenticación y autorización del backend. Los permisos y capacidades dependen del navegador y del dispositivo; verificar Safari iOS con la PWA instalada cuando corresponda.

El estado Aceptada acredita respuesta satisfactoria del proveedor, no recepción ni lectura humana. Una caída entre envío y persistencia puede repetir el envío; un tag estable reduce duplicados visibles. El TTL predeterminado de transporte es una hora.

Al cerrar sesión explícitamente se retira primero la asociación del servidor y luego la suscripción del navegador. Si falla la red, se muestra el error y se permite reintentar. Ante un cambio externo de cuenta, la suscripción local anterior se cancela; no se reasigna su destino a la nueva cuenta. Una asociación remota anterior puede permanecer hasta que el proveedor comunique su expiración.

Parámetros opcionales de NotificacionesPush: IntervaloSegundos=5, Lote=50, Concurrencia=4, MaximoIntentos=8 y TtlSegundos=3600. El envío tiene tiempo máximo de diez segundos y reclamación por sesenta segundos.

## Contratos

- GET /api/notificaciones/configuracion, con idSuscripcion opcional documentado mediante QueryParam, devuelve disponibilidad, clave pública y estado de la suscripción del propietario.
- POST /api/notificaciones/suscribir recibe urlDestino, clavePublica y secretoAutenticacion. Es idempotente para el mismo propietario y devuelve id y activa.
- DELETE /api/notificaciones/desuscribir recibe idSuscripcion como JSON y devuelve id y activa=false.

Los errores usan RFC 7807 con Detail. Todos los clientes provienen de Orval. El script de exportación ahora compila el backend antes de exportar, evitando contratos obtenidos de un binario anterior.

## Verificación automatizada

Desde la raíz:

- dotnet build RACPD.Backend
- dotnet run --project pruebas/RACPD.Notificaciones.Pruebas

Desde RACPD.Frontend:

- npm run api:generate; en Windows PowerShell usar npm --script-shell=cmd.exe run api:generate.
- npm run build
- node --test scripts/pruebas-push.mjs

Para incluir integración, definir RACPD_PRUEBAS_DB con una base PostgreSQL exclusivamente de pruebas. El ejecutable crea un esquema racpd_pruebas_ seguido de un identificador aleatorio y lo elimina al finalizar; nunca toma la conexión de Supabase del archivo .env. Valida selección de destinatarios, exclusión de ajenos, roles de vínculo, materialización concurrente, reclamaciones exclusivas, recuperación del arrendamiento, revocación, fallos parciales, reintentos y baja de destinos vencidos. También aplica y revierte la migración push sobre tablas previas y verifica VersionCarga=1 para mensajes existentes.

Resultados obtenidos: compilación de backend sin errores ni advertencias; tres comprobaciones HTTP de autenticación con errores RFC 7807; 35 verificaciones de seguridad, modelo y transporte cifrado; pruebas de integración con PostgreSQL 18; cuatro pruebas del Service Worker. El frontend pasó lint, TypeScript y Vite. EF Core confirmó que el modelo no tiene cambios pendientes respecto de la migración. El envío y recepción en celulares reales queda pendiente de la configuración del contacto VAPID y de la prueba en esos dispositivos.

## Hallazgo en el historial de migraciones

Al aplicar todo el historial sobre una base vacía aislada, la migración preexistente 20260910131906_AgregarRecurrenciaYTareasBloqueTurno falla porque intenta modificar BloquesTurno cuando la tabla todavía no existe. Esto impide inicializar una base nueva mediante el historial actual. La migración push se verificó por separado sobre su esquema previo. No se modificó el historial anterior ni se aplicaron cambios a bases compartidas. Antes de inicializar una base desde cero, el equipo debe reconciliar ese historial con su esquema real.

## Pruebas adicionales del recorrido completo

Se amplió el ejecutable de pruebas con un servidor ASP.NET de integración. Usa el manejador JWT real y firmas RS256 temporales; la fuente de claves del emisor se sustituye por una configuración pública local, sin contactar Supabase. Se comprobaron rechazo sin sesión y con token vencido; alta y baja idempotentes; consulta de estado; rechazo de reasignación a otra cuenta; rechazo de baja ajena y destinos internos; cierre HTTP de turnos Mal, MuyMal y Neutral; rechazo de cierres repetidos; y procesamiento de los dos eventos críticos hasta cuatro envíos cifrados al transporte simulado. No se modificó el correo VAPID del entorno.

También se ejercitaron las vistas React reales en un navegador mediante un banco de pruebas local: activación desde móvil, desactivación desde escritorio, permiso bloqueado, error de servidor y falta de compatibilidad. Los permisos y suscripciones en ese banco son simulados y no generan avisos del sistema operativo. La vista se comprobó con un tamaño móvil y sin desbordamiento horizontal (375 píxeles de contenido y de área visible).

Para repetir la comprobación visual, ejecutar npm run pruebas:push:interfaz desde RACPD.Frontend; en Windows PowerShell usar npm --script-shell=cmd.exe run pruebas:push:interfaz. Solo abre un servidor de pruebas en 127.0.0.1:55441 y no usa cuentas reales. Las capturas están en docs/evidencias/notificaciones-interfaz.jpg y docs/evidencias/notificaciones-movil.jpg.

No se ha comprobado la recepción real desde FCM, Mozilla o Apple, ni una PWA instalada en Android o Safari iOS: este equipo no dispone de esos teléfonos conectados. Esa prueba necesita el contacto VAPID configurado y dispositivos con permiso concedido. No se aplicaron migraciones a Supabase ni se fusionó la rama en main.
