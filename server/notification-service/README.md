# Informes y notificaciones

Servicio implementado en este repo, con SQLite persistente, scheduler semanal,
cola de envíos y seguimiento de tickets/receipts de Expo. Requiere Node >=24.14.
La app consulta preferencias y snapshots reales por `EXPO_PUBLIC_NOTIFICATIONS_API_URL`.
Sin esa URL, los interruptores quedan deshabilitados; ya no hay altas simuladas.

## Dependencias externas pendientes

No se cuenta con el código del proveedor de identidad/reportes, Firebase ni APNs.
No se puede activar producción hasta disponer de:

1. Una consulta autenticada que devuelva una identidad estable y su vencimiento.
2. Una consulta de agregados autorizada para trabajos de servidor (sin guardar contraseñas ni tokens de usuarios).
3. Credenciales de FCM/APNs y una build instalada para pruebas reales.
4. Una señal fiable de cierre de función, si se habilita esa categoría.

Los contratos siguientes son los que implementa este servicio; **no se afirma
que el backend actual de Tuentrada ya los exponga**. Sus rutas se configuran.
Si el proveedor usa otro formato, adaptar `adapters.mjs` y sus pruebas.

## Arranque

Copiar las variables de `.env.example` al entorno y completar los valores:

- `NOTIFICATION_IDENTITY_URL`: URL exacta del endpoint de identidad.
- `NOTIFICATION_REPORT_SOURCE_URL`: URL exacta de agregados para tareas.
- `NOTIFICATION_REPORT_SOURCE_TOKEN`: credencial de servicio para esos agregados.
- `NOTIFICATION_INTERNAL_SECRET`: secreto aleatorio de al menos 32 caracteres,
  exclusivo del webhook interno. Generar, por ejemplo, con `openssl rand -hex 32`.
- `NOTIFICATION_DB_PATH`: archivo persistente, por defecto `var/notifications.sqlite`.
- `EXPO_PUSH_ACCESS_TOKEN`: si el proyecto de Expo exige seguridad adicional.
- `NOTIFICATION_ALLOWED_ORIGIN`: origen de Expo Web si se usa navegador. En móvil no hace falta CORS.

Ejecutar `npm ci` y `npm run notifications:server`.
El servicio valida configuración y falla explícitamente si faltan integraciones.
No hay una autenticación demo accesible desde el servidor de producción.
Las pruebas usan adaptadores ficticios inyectados y SQLite temporal.

## Identidad del proveedor

`GET NOTIFICATION_IDENTITY_URL`, con `Authorization: Bearer <sesión>` y,
si se configura `REPORT_API_KEY`, `x-api-key`. Respuesta:

```json
{"data":{"userId":"u_123","accountId":"a_456","timezone":"America/Argentina/Buenos_Aires","expiresAt":"2026-12-01T00:00:00Z"}}
```

El proveedor valida la sesión y devuelve la cuenta activa y su zona horaria.
No se aceptan userId/accountId en los endpoints públicos de escritura.
Los informes se aíslan por **cuenta y usuario**, pues usuarios de una misma
cuenta podrían tener permisos diferentes. Un informe ajeno devuelve 404.
No cambiar esto por aislamiento sólo por cuenta sin validar las reglas del proveedor.

## Fuente de informes

`POST NOTIFICATION_REPORT_SOURCE_URL`, con Bearer de servicio y este cuerpo:

```json
{"accountId":"a_456","userId":"u_123","type":"weekly_report","periodStart":"2026-09-07","periodEnd":"2026-09-13","timezone":"America/Argentina/Buenos_Aires","functionId":null,"eventId":null}
```

Respuesta:

```json
{"data":{"metrics":{"entradasPagas":100,"invitaciones":10,"entradasTotales":110,"recaudacionARS":100000,"precioPromedioARS":1000,"compradoresUnicos":80}}}
```

`eventName` es opcional junto a `metrics`. La fuente debe comprobar que el
usuario sigue teniendo acceso a la cuenta y a las funciones incluidas. El período
es inclusivo, de venta, en la zona indicada. No calcular compradores únicos
sumando compradores por función: debe contarlos la fuente sobre el conjunto.
Rechazar revocaciones, datos parciales y agregados fallidos; no sustituirlos por ceros.
Los datos del snapshot se validan contra `shared/notifications.ts`.

## API que consume la app

| Método y ruta | Resultado |
|---|---|
| GET `/health` | Estado del proceso, sin información de cuentas |
| GET `/api/v1/notification-preferences` | `{data:{functionReports,weeklySummary}}` |
| PUT `/api/v1/notification-preferences` | Persiste esas dos preferencias del usuario autenticado |
| POST `/api/v1/devices` | Registra token y metadatos; 204 |
| DELETE `/api/v1/devices/:expoPushToken` | Baja de esa sesión; 204 |
| GET `/api/v1/reports/:reportId` | Snapshot o estado de generación; 404 para ausente/ajeno |

El body de dispositivos es `{expoPushToken,platform,appVersion,timezone,language}`.
La zona del **calendario** viene de la identidad validada, no de los metadatos del teléfono.
Al cambiar de cuenta con permiso del sistema concedido, la app vuelve a registrar
el token aunque la cuenta nueva tenga todas las categorías apagadas: cambia el
dueño del dispositivo y evita recibir avisos de la cuenta anterior.
Guardar un dispositivo no habilita categorías por sí solo.

## Cierre de función

El proveedor llama `POST /internal/function-closed` con Bearer igual a
`NOTIFICATION_INTERNAL_SECRET` y body:

```json
{"accountId":"a_456","userId":"u_123","functionId":"f_789","periodStart":"2026-09-01","periodEnd":"2026-09-14","timezone":"America/Argentina/Buenos_Aires"}
```

Puede incluir `eventId`. Devuelve 202 con `reportId`, o 204 si ese usuario no
optó por informes de funciones. Repetir el evento con el mismo alcance y período
no duplica el informe. El emisor debe fijar el mismo período para cada cierre.
No se infiere el cierre de la hora de inicio. El emisor también es responsable
de enumerar únicamente destinatarios autorizados.

## Procesamiento y garantías

- El scheduler corre cada 30s, desde el lunes a las 09:00 de la cuenta. Recupera
  la semana anterior si la ejecución se perdió, sin duplicarla durante esa semana.
- Snapshot y cola se confirman en una transacción. El aviso sale después de guardar
  el informe; el modelo de IA no interviene en cálculos ni envíos.
- La clave única incluye usuario, cuenta, tipo, función/evento y período.
- Preferencias, propietario del token y vigencia se comprueban otra vez antes de enviar.
- Cada registro vence al vencer la sesión del proveedor o a las 24h (lo que suceda
  antes). Abrir la app lo renueva. **Límite de esta beta:** no envía a usuarios
  ausentes más allá de esa vigencia. Para envíos independientes de sesiones,
  el proveedor debe aportar revocación de dispositivos/cuentas fiable; no ampliar
  silenciosamente la vigencia mientras esa integración no exista.
- Generación y errores explícitos transitorios de envío reintentan hasta cinco veces.
- Tickets se consultan después de 15 minutos. `DeviceNotRegistered` desactiva el token.
- `accepted` significa aceptado por FCM/APNs, no leído ni recibido en el dispositivo.
- Un timeout de envío o caída entre envío y ticket queda `unknown`, sin reenvío
  automático. No se promete entrega exactamente una vez: Expo no ofrece una clave
  de idempotencia extremo a extremo. Las caídas ambiguas requieren revisión.
- Un worker que pierde su lease no puede sobrescribir el resultado de otro.

## Operación

Una instancia y un volumen local persistente para SQLite; no colocar el archivo
en un filesystem de red. Respaldar el volumen según la política de conservación
de informes. `store.stats()` expone conteos para inspección local; no hay un panel
público que filtre información. Los códigos de fallo están en jobs/deliveries.
La eliminación histórica y política de conservación deben acordarse antes del lanzamiento.
Al escalar a varias máquinas, migrar la cola a una base compartida con claims transaccionales.

## Firebase y prueba real

Crear el proyecto Firebase para `com.stalgis.tuentrada`; descargar el archivo
cliente `google-services.json` y configurar `GOOGLE_SERVICES_JSON` como variable
EAS de tipo archivo. Subir la cuenta de servicio FCM v1 a EAS. Configurar APNs
para `com.stalgis.tuentrada` en iOS. No poner credenciales del servidor en variables
`EXPO_PUBLIC_*`. `app.config.js` impide builds Android con push habilitado sin JSON.

Probar en iOS/Android: primer permiso, rechazo, ajustes, app abierta/cerrada,
login desde un aviso, cambio de cuenta sin logout previo, revocación durante una
solicitud y dos avisos consecutivos. Verificar contenido y período del snapshot,
no sólo que la notificación aparezca.

Referencias: [Expo FCM](https://docs.expo.dev/push-notifications/fcm-credentials/),
[tickets y receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
