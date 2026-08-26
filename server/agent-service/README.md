# Servicio Node del agente

Conecta una única herramienta de solo lectura al catálogo real del usuario
autenticado. Todavía no consulta ventas, recaudación, pagos ni sectores.

## Flujo

```text
Expo AuthProvider
  -> Authorization: Bearer <accessToken>
  -> POST /api/agent/chat { message, conversationId }
  -> validación contra /api/v2/report/event-list
  -> ReportApiClient ligado a esa sesión
  -> topes: presupuesto diario, límite por sesión, concurrencia
  -> historial previo de esa conversación
  -> RunContext local
  -> tool buscar_eventos
  -> respuesta del agente + requestId
```

El token no forma parte del prompt, de los parámetros de la herramienta ni de
la respuesta: fuera del módulo de auth sólo circula su fingerprint. Antes de
gastar una llamada a OpenAI, el servicio verifica que el backend real acepte la
sesión.

## Configuración

El `.env` local ya debe tener las variables usadas por Expo:

```dotenv
OPENAI_API_KEY=...
EXPO_PUBLIC_BASE_URL=https://...
EXPO_PUBLIC_API_KEY=...
```

Para un despliegue backend separado, usar las variantes server-only:

```dotenv
REPORT_API_BASE_URL=https://...
REPORT_API_KEY=...
```

Los topes, timeouts y TTLs están documentados en `.env.example`. Todos tienen
default; ninguno hace falta para desarrollo local.

En un simulador iOS o en Expo Web, el servicio puede escuchar solamente en
localhost:

```dotenv
AGENT_SERVICE_HOST=127.0.0.1
```

En un teléfono físico dentro de la misma red local:

```dotenv
AGENT_SERVICE_HOST=0.0.0.0
EXPO_PUBLIC_AGENT_API_URL=http://IP_DE_TU_COMPUTADORA:8787
```

No usar `0.0.0.0` como URL en la app. Es una dirección de escucha, no una
dirección a la que el teléfono pueda conectarse.

Si `EXPO_PUBLIC_AGENT_API_URL` no está definida y la build no es de desarrollo,
la app esconde la tarjeta "Agente beta": no tiene sentido dejar entrar a una
pantalla que va a fallar al primer envío.

## El arranque falla a propósito si

- Falta `OPENAI_API_KEY`, `REPORT_API_BASE_URL` o `REPORT_API_KEY`.
- `OPENAI_AGENT_MODEL` no existe o la cuenta no tiene acceso. Un id de modelo
  dado de baja convertiría cada petición en un 500 genérico sin pista.
- `NODE_ENV=production` con `AGENT_ALLOWED_ORIGIN=*`.
- `NODE_ENV=production` con `AGENT_EXPOSE_TOOL_CALLS=true`.
- `REPORT_API_TIMEOUT_MS >= AGENT_REQUEST_TIMEOUT_MS`: si el upstream puede
  consumir el presupuesto entero, el timeout total declarado es mentira.

Un fallo de red al verificar el modelo sólo avisa, no bloquea.

## Probar desde Expo

1. Iniciar el servicio:

   ```bash
   npm run agent:server
   ```

2. Iniciar o recargar Expo después de cambiar variables `EXPO_PUBLIC_*`.
3. Iniciar sesión con un usuario real.
4. Abrir **Perfil -> Agente beta -> Probar agente**.
5. Preguntar `¿Cuántos eventos tengo?` y después `¿y la semana que viene?`, para
   verificar que el agente mantiene el hilo.

## Conversaciones

La app genera un `conversationId` por apertura de la pantalla y lo manda en cada
mensaje. El servicio guarda el historial con clave
`${fingerprintDelToken}:${conversationId}`.

El fingerprint en la clave no es decorativo: sin él, mandar el `conversationId`
de otro alcanzaría para leer su conversación.

El historial vive en memoria del proceso: se pierde al reiniciar y no sirve con
más de una instancia. Para el beta alcanza; con réplicas hay que moverlo a Redis.

## Observabilidad

Cada petición escribe una línea JSON con `requestId`, fingerprint de sesión,
status, duración, `turnos`, `upstream`, tokens y los parámetros con que el
modelo llamó cada tool.

`AGENT_GLOBAL_RATE_LIMIT_MAX` se aplica antes de autenticar; evita que alguien
rote tokens inválidos para saltear `AGENT_RATE_LIMIT_MAX`, que sigue siendo el
límite por sesión autenticada.

El campo `limites` registra las guardas que se activaron, en su propio canal y
no mezcladas con los errores de parámetros. Hoy la única que registra es el tope
de funciones de `disponibilidad`, y contarla es lo que decide si vale la pena
construir el snapshot de la fase 2:

```bash
grep -c '"tipo":"funciones_disponibilidad"' agent.log
```

Y para ver qué eventos son los que no entran:

```bash
grep -o '"tipo":"funciones_disponibilidad","evento":"[^"]*","funciones":[0-9]*' agent.log | sort | uniq -c | sort -rn
```

`turnos` y `upstream` son los que hacen ajustable `AGENT_MAX_TURNS` con datos en
vez de a ojo: el primero dice si el tope quedó corto, el segundo cuánto costó de
verdad la pregunta. Un fallo previo a la autenticación los deja en `null`, no en
cero: cero significaría "no consultó nada" y ensuciaría cualquier promedio.
Ese último dato es el más útil: muestra cómo el modelo interpretó la pregunta y
delata una descripción de schema mal escrita.

El `requestId` también viaja al cliente. Cuando alguien reporte "me contestó
cualquier cosa", ese id encuentra el run en el log.

`GET /health` devuelve además el estado de los topes: peticiones en vuelo,
tokens del día y presupuesto configurado.

## Límites intencionales

- Cinco herramientas: `buscar_eventos` (catálogo), `resumen_de_ventas` (totales),
  `evolucion_de_ventas` (serie diaria), `medios_de_pago` y `disponibilidad`
  (sectores de un evento).
- **Tope de consultas al backend por petición** (`AGENT_MAX_UPSTREAM_CALLS`, 25).
  El límite de cada herramienta es por llamada; este es por pregunta. Sin él, un
  run de varios turnos podía encadenar doce consultas de disponibilidad seis
  veces. Las consultas repetidas no gastan presupuesto: el memo las absorbe.
- Quedarse sin turnos sale como 502 con mensaje propio, no como un 500 genérico:
  es la señal de que `AGENT_MAX_TURNS` quedó corto y tiene que poder contarse.
- `disponibilidad` es de un evento por vez y tiene tope de 12 funciones:
  `online-sales` es el único endpoint sin forma de lote, y el tope es lo que
  evita que reabra el fan-out que el resto del diseño esquiva. En catálogos
  reales hay eventos de 98 funciones, así que el tope se activa: cada vez que
  pasa queda anotado en el campo `limites` de la línea de log.
- **Dos ejes temporales distintos, a propósito.** `periodo` filtra cuándo OCURRE
  el evento; `periodoDeVenta` filtra cuándo se HIZO la venta. Los nombres y los
  valores no se solapan (`todos` contra `todo`) para que el modelo no use uno
  creyendo que usa el otro.
- **El modelo no hace aritmética.** Para comparar períodos usa `compararCon` y
  lee el campo `variacion`, calculado en código. Un porcentaje mal calculado
  sobre plata se lee tan convincente como uno bien calculado.
- **Los nombres de campo del backend no llegan al modelo.** `total` es plata,
  `total_tickets` es cantidad e incluye invitaciones: se traducen a
  `recaudacionARS`, `entradasPagas`, `invitaciones` y `entradasTotales` antes de
  salir. Los arrays `chart*` se descartan.
- Los períodos relativos se calculan en hora de Argentina y el límite de 30 se
  aplica después de filtrar.
- Máximo 30 eventos por resultado enviado al modelo.
- **El modelo ve eventos, no funciones.** `event-list` devuelve una fila por
  función; el servicio las agrupa por nombre, igual que la app
  ([eventCatalog.mjs](eventCatalog.mjs)). Un unipersonal de 10 fechas es un
  evento con 10 funciones, no 10 eventos.
- Cada evento trae un `ref` opaco (`ev_` + 8 hex del nombre normalizado). Es el
  handle con el que las herramientas de ventas van a pedir datos de ese evento:
  el modelo nunca toca ids de función. Un ref que no está en el catálogo de esa
  sesión falla con un error recuperable, nunca devuelve datos de otro evento.
- El modelo recibe ref, nombre, cantidad de funciones, rango de fechas y
  `yaOcurrio`; no recibe el token, ids de función ni información de compradores.
- `yaOcurrio` sólo dice si la fecha ya pasó. El backend no expone estado
  comercial: no se sabe si un evento está cancelado, agotado o pausado, y el
  prompt le prohíbe al modelo afirmarlo.
- Los eventos sin fecha usable no entran en ningún filtro temporal, pero se
  cuentan aparte (`sinFecha`) para que el modelo pueda decirlo en vez de
  omitirlos en silencio.
- Un 401/403 upstream evita la llamada a OpenAI.
- Un error de parámetros de la tool vuelve al modelo como texto para que
  corrija; un fallo de infraestructura sube y termina la petición.

## Deuda conocida

- **Sin streaming.** El `fetch` de React Native no expone `response.body` como
  stream, así que mostrar la respuesta token a token requiere pasar el endpoint
  a SSE y leerlo con XHR e `onprogress` en el cliente. Mientras tanto la
  pantalla muestra "Pensando…" y un botón para cancelar.
- **Estado en memoria.** Historial, caché de catálogo y topes viven en el
  proceso. Con más de una instancia cada una aplica su propia porción y el
  presupuesto diario hay que dividirlo entre réplicas.
- **Sin endpoint barato de validación de sesión.** La caché de catálogo es el
  parche; pedir un `/me` liviano al backend es la solución.

## Próximo paso

El acceso a datos de ventas está planeado en [PLAN-DATOS.md](PLAN-DATOS.md). El
paso 1 (catálogo de dos niveles y `ref`) ya está; siguen `resumen_de_ventas`,
`evolucion_de_ventas`, `medios_de_pago` y `disponibilidad`.
