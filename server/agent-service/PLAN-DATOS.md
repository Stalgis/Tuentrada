# Plan de acceso a datos del agente

Estado: **fase 1 completa e instrumentada** (pasos 1 a 4). Queda medir con uso real y decidir la fase 2.
Contexto: hoy el agente sólo lee el catálogo de eventos. Este documento define
cómo llega a los datos de ventas.

## Decisiones tomadas

| # | Decisión | Elegida |
|---|---|---|
| D1 | Desglose por evento (fan-out) | Fase 1 sólo endpoints de una llamada. Ranking a fase 2 con snapshot. |
| D2 | Cómo se eligen los eventos | Handle opaco de dos pasos: `ref` estable, validado contra el catálogo de la sesión. |
| D3 | Disponibilidad por sectores | Entra en fase 1, sólo sobre un evento ya elegido, con tope duro. |

---

## 1. Inventario de datos (verificado en el código)

| Endpoint | Método | Costo | Devuelve |
|---|---|---|---|
| `/api/v2/report/event-list` | GET | 1 | Una fila **por función**. Label `"Nombre - YYYY-MM-DD HH:MM:SS"`. Sin estado, sin id de evento padre. |
| `/api/v2/report/stats` | POST `{ids:[]}` + `?date=` | 1 | **Un agregado** del conjunto de ids. |
| `/api/v2/report/history` | POST `{ids:[]}` + `?date=` | 1 | Serie por día + una fila `TOTAL`. |
| `/api/v2/report/payments` | POST `{ids:[]}` + `?date=` | 1 | Filas por medio de pago. |
| `/api/v2/report/online-sales` | GET `?id=` | **1 por función** | Filas por sector. |

Valores de `date` soportados ([useGlobalStats.ts:14](../../src/hooks/useGlobalStats.ts)):
`all`, `this_week`, `last_week`, `this_month`, `last_month`, `custom` (+ `dateFrom`, `dateTo`).

**El muro:** ningún endpoint devuelve desglose por evento. `stats` con 50 ids
devuelve un número, no cincuenta. Rankear exige una llamada por función, que es
lo que hace [apiClient.ts:141](../../src/lib/apiClient.ts) con concurrencia 8.
Por eso el ranking queda fuera de la fase 1.

---

## 2. Bug del estado actual que la fase 1 tiene que arreglar — RESUELTO (paso 1)

**El agente contaba funciones y las llamaba eventos.**

`event-list` devuelve una fila por función. La app las agrupa por nombre
([apiClient.ts:66](../../src/lib/apiClient.ts), `groupEventsByName`). El agente
no agrupa: [reportApiClient.mjs](reportApiClient.mjs) mapea cada recurso a un
evento y `searchEventCatalog` los cuenta directo.

Consecuencia hoy: un usuario con 1 evento de 10 funciones pregunta "¿cuántos
eventos tengo?" y escucha "tenés 10 eventos".

Esto deja de ser cosmético en la fase 1: las métricas se piden por evento y se
resuelven a ids de función. Sin agrupar, el `ref` de D2 no tiene a qué apuntar.

**Resuelto** en [eventCatalog.mjs](eventCatalog.mjs): el catálogo tiene dos
niveles, evento (ref, nombre, N funciones, rango de fechas) y función (id,
fecha). El modelo sólo ve eventos. Verificado end to end: 7 filas del backend
con un unipersonal de 4 funciones se reportan como 4 eventos.

---

## 3. Las dos trampas del schema

### 3.1 Dos ejes temporales con las mismas palabras

- **Eje A, fecha del evento**: cuándo ocurre. Es el `periodo` que ya existe en
  `buscar_eventos`.
- **Eje B, fecha de la venta**: cuándo se compró. Es el `date` de
  `stats` / `history` / `payments`.

Son ejes independientes y las preguntas los mezclan:

| Pregunta | Eje A (qué eventos) | Eje B (qué ventas) |
|---|---|---|
| "¿Cuánto vendí este mes?" | todos | `this_month` |
| "¿Cuánto vendí de los eventos de este mes?" | `este_mes` | `all` |
| "¿Cuánto se vendió la semana pasada del Festival?" | ref del Festival | `last_week` |

Si los dos parámetros se llaman `periodo`, el modelo los va a cruzar y la
respuesta va a ser plausible y falsa.

**Regla:** `periodo` queda sólo en `buscar_eventos` (eje A). Las tools de
métricas usan `periodoDeVenta`, con enum propio y descripción explícita. Toda
respuesta del agente nombra el período que usó.

### 3.2 Los nombres de campo del backend mienten

De `StatsData` ([reportApi.ts:160](../../src/lib/reportApi.ts)):

| Campo backend | Qué es en realidad | Nombre que ve el modelo |
|---|---|---|
| `tickets` | entradas **pagas** | `entradasPagas` |
| `invitations` | invitaciones (gratis) | `invitaciones` |
| `total_tickets` | pagas + invitaciones | `entradasTotales` |
| `total` | **plata**, en ARS | `recaudacionARS` |
| `ticket_medio` | precio promedio | `precioPromedioARS` |
| `unique_buyers` | compradores únicos | `compradoresUnicos` |

`total` es plata pero se llama total. `total_tickets` es cantidad. Un modelo que
recibe `total: 4200000` junto a `total_tickets: 850` puede decir "vendiste
4.200.000 entradas" sin ninguna señal de que se equivocó.

**Regla:** ninguna tool devuelve nombres del backend. Se traducen siempre, y las
magnitudes monetarias llevan la moneda en el nombre del campo.

**Regla:** los arrays `chartTickets`, `chartInvitations`, `chartTotalTickets`,
`chartTotal`, `chartUniqueBuyers` **no van al modelo**. Son ruido y tokens; la
serie temporal con etiquetas la da `history`.

---

## 4. El `ref` (D2)

- `buscar_eventos` devuelve, por evento, un `ref` = `ev_` + 8 hex del sha256 del
  nombre normalizado. Determinista, estable entre peticiones, sin estado extra.
- Las tools de métricas aceptan `refs: string[]` o `alcance: "todos"`. Nunca ids.
- El código resuelve ref → evento → ids de función (equivalente a
  `getEventFunctionIds`) contra el catálogo cacheado de esa sesión.
- Un ref que no está en el catálogo lanza `ToolInputError`: vuelve al modelo como
  texto para que corrija, gracias al `errorFunction` ya implementado en
  [agent.mjs:60](agent.mjs). Nunca devuelve datos de otro evento.

Esto obliga al modelo a haber mirado el catálogo antes de pedir plata, que ya es
la regla del prompt.

---

## 5. Superficie de tools (fase 1)

### 5.1 `buscar_eventos` (existente, modificada)
Agrupa por nombre y agrega `ref`, `cantidadDeFunciones` y rango de fechas.
Sigue filtrando por **fecha de evento** (eje A).

### 5.2 `resumen_de_ventas({ refs, periodoDeVenta, compararCon })` — HECHO
→ `POST /stats` (1 llamada, 2 si se pide comparación; salen en paralelo).
`refs: null` significa toda la cuenta.
Devuelve `entradasPagas`, `invitaciones`, `entradasTotales`, `recaudacionARS`,
`precioPromedioARS`, `compradoresUnicos`, más `alcance` y `periodoAplicado` en
texto legible.
Con `compararCon` agrega `comparacion` y `variacion`, esta última calculada en
[salesSummary.mjs](salesSummary.mjs): el modelo no hace aritmética sobre plata.
El eje de venta vive en [salesPeriods.mjs](salesPeriods.mjs), separado del de
fechas de evento.

### 5.3 `evolucion_de_ventas({ refs, periodoDeVenta })` — HECHO
→ `POST /history` (1 llamada). En [salesHistory.mjs](salesHistory.mjs).
`day_date` llega en dos formatos (`YYYY-MM-DD` y `DD/MM/YYYY`) y se normaliza
antes de que el modelo lo vea: "05/03/2026" es 5 de marzo o 3 de mayo según
quién lo lea. Los días ilegibles se cuentan (`diasIlegibles`) en vez de
desaparecer. `mejorDia` viene elegido por código.
Serie por día (`fecha`, `entradasPagas`, `invitaciones`, `recaudacionARS`) más el
total como **campo aparte**, nunca como una fila más: `reportApi` ya separa la
fila `TOTAL` y si vuelve a la lista el modelo la suma dos veces.
Truncar a los últimos 60 días con `truncated: true`, mismo patrón que ya usa
`buscar_eventos`.

### 5.4 `medios_de_pago({ refs, periodoDeVenta })` — HECHO
→ `POST /payments` (1 llamada). En [paymentMethods.mjs](paymentMethods.mjs).
Ordenado de mayor a menor y con `porcentajeDeRecaudacion` calculado en código.
El campo se llama `entradas`, no `entradasPagas`: si el backend emitiera una
fila "Invitación", llamarlas pagas sería falso.
`total_revenue` a veces viene como string; reusar la normalización que ya hace
[reportApi.ts:305](../../src/lib/reportApi.ts), no reimplementarla.

### 5.5 `disponibilidad({ ref })` — HECHO (D3)
→ `GET /online-sales?id=` por función. En [availability.mjs](availability.mjs).
Interpretación igual que SectorScreen: `disponibles` = available,
`vendidas` = purchase (sin invitaciones), `bloqueadas` = kill + promoter_blocked.
`otrosEstados` junta lo que ni la app interpreta (booking, issue, in_progress,
session_pack) para que las partes sumen el total: sin ese campo el modelo se
inventa una explicación para la diferencia.
- Exige **un** ref, nunca `"todos"`.
- Tope duro de 12 funciones; si el evento tiene más, `ToolInputError` con un
  mensaje que le pide al modelo acotar.
- Suma los sectores entre funciones en código y devuelve por `price_type`:
  `disponible`, `vendido`, `invitaciones`, `bloqueado`.

---

## 6. Reglas de prompt nuevas

1. Antes de pedir métricas, llamar `buscar_eventos` y usar los `ref` que devuelve.
   Nunca inventar un ref.
2. Nombrar siempre el período de venta usado en la respuesta.
3. No hacer aritmética. Si el usuario pide una comparación o una variación, pedir
   los dos períodos y usar el campo `variacion` que calcula la tool.
4. `entradasPagas` e `invitaciones` son cosas distintas. No decir "vendidas" por
   `entradasTotales`.
5. No proyectar, no estimar, no extrapolar. Si el dato no está, decirlo.
6. Si `truncated` es true, decirlo.
7. El ranking entre eventos no está disponible: explicarlo y ofrecer el total o
   el detalle de un evento puntual.

**Los números los calcula el código, no el modelo.** El proyecto ya tiene ese
precedente: `applyStatsToFlatEvents` calcula el precio promedio en código, y
`labs/agent-sdk` ya tiene tests llamados "calcula comparaciones de eventos en
código" y "calcula variaciones entre períodos en código".

---

## 7. Lo que la fase 1 NO responde

Explícito en el prompt, para que el agente lo diga en vez de inventarlo:

- "¿Cuál de mis eventos vendió más?" → fase 2 (ranking).
- Disponibilidad de todos los eventos a la vez, o de un evento con más de 12 funciones → reabre el fan-out.
- Proyecciones, predicciones, "¿voy a agotar?".
- Datos de compradores individuales. No están en estos endpoints y no deberían.

---

## 8. Riesgos verificados

| Riesgo | Evidencia | Mitigación |
|---|---|---|
| `date=last_month` da 504 en cuentas grandes ✅ | Bug de backend ya conocido, rompe "Ingresos del mes" en la app | **Excepción deliberada, ya implementada** al criterio de errores: convertir ese timeout en mensaje visible al modelo ("ese período no está disponible, ofrecé `este_mes` o un rango personalizado"). Es el único error de infraestructura donde el modelo tiene una acción alternativa válida. |
| Agrupar por nombre fusiona eventos homónimos | `groupEventsByName` usa el nombre como clave | Aceptado en fase 1 (la app ya vive con esto). Pedir a backend un id de evento padre. |
| `history` con `date=all` puede traer cientos de días ✅ | Sin tope antes | Truncado a 60 días + `truncated`. El total se calcula sobre la serie completa, así que recortar no cambia la cifra global. |
| Presupuesto de 25s con más tools ✅ | `maxTurns` era 4, 12s de timeout upstream | `maxTurns` a 6 más tope de 25 consultas al backend por petición. `turnos` y `upstream` van a la línea de log. Si el p95 de `durationMs` se acerca al timeout total, bajar `REPORT_API_TIMEOUT_MS` antes que subir el total. |
| Montos en los logs | El log ya registra parámetros de tool | Los parámetros son refs y períodos, no montos. **Regla: ningún importe entra al log.** |
| Presupuesto de tokens | `AGENT_DAILY_TOKEN_BUDGET` = 1M | Las respuestas de stats son chicas; `history` truncado a 60 días es el techo. Revisar el tope después de una semana de uso real. |

---

## 9. Orden de implementación

**Paso 1 — base (bloqueante para todo lo demás)** — HECHO
Agrupación por nombre en el servicio + `ref` en `buscar_eventos` + resolución
ref → ids de función, en [eventCatalog.mjs](eventCatalog.mjs).
`resolveEventRefs` y `allFunctionIds` son el contrato que consumen los pasos 2
y 3: reciben lo que devuelve `buscar_eventos` y entregan ids de función.

**Paso 2 — la tool que más se va a usar** — HECHO
`resumen_de_ventas`. Cubre "¿cuánto vendí?" en todas sus variantes, de toda la
cuenta o de eventos puntuales, con comparación entre períodos.

**Paso 3 — el resto de la fase 1** — HECHO
`evolucion_de_ventas`, `medios_de_pago`, `disponibilidad`.

**Paso 4 — prompt y guardas** — HECHO
Reglas de la sección 6, `maxTurns` a 6 (configurable), la excepción de
`last_month`, y dos guardas que no estaban en el plan original:

- **Tope de consultas al backend por petición** (`AGENT_MAX_UPSTREAM_CALLS`, 25).
  El tope de 12 funciones de `disponibilidad` es por llamada, no por pregunta:
  con seis turnos el modelo podía encadenarlo seis veces y disparar 72
  consultas. Subir `maxTurns` sin este techo era abrir esa puerta.
- **Turnos agotados como error propio** (502), en vez de caer entre los 500
  genéricos. Es justamente la señal que hay que contar para saber si el tope
  quedó corto.

Y la instrumentación que hace medible el ajuste: `turnos` y `upstream` en la
línea de log de cada petición.

**Fase 2 (después de medir uso real)**
Snapshot precomputado por sesión → habilita ranking y disponibilidad global.
Antes de construirlo, mirar el log y confirmar tres cosas:

1. Que la gente efectivamente pide ranking (`toolCalls` y las respuestas donde
   el agente dice que no puede).
1b. Cuántas veces se topea `disponibilidad`. En catálogos reales hay eventos de
   98 funciones contra un tope de 12, así que esta cuenta puede ser el argumento
   más fuerte para la fase 2:
   `grep -c '"tipo":"funciones_disponibilidad"' agent.log`
2. Que `turnos` no está pegado al tope: si lo está, el problema es otro.
3. Que `upstream` por pregunta está lejos de 25: si ya roza el tope, el
   snapshot es todavía más necesario de lo que parecía.

---

## 10. Tests a escribir junto con cada paso

| Paso | Test | |
|---|---|---|
| 1 | Un evento con 10 funciones se cuenta como 1 evento, no como 10. ✅ |
| 1 | El `ref` es estable entre dos llamadas y distinto entre eventos. ✅ |
| 1 | Un ref inventado lanza `ToolInputError` y vuelve al modelo, sin pegarle al backend. ✅ |
| 1 | Resolver un ref devuelve exactamente los ids de función de ese evento. ✅ |
| 2 | Los campos que ve el modelo no incluyen ningún nombre crudo del backend. ✅ |
| 2 | Los arrays `chart*` no salen en el payload al modelo. ✅ |
| 2 | `periodoDeVenta` y `periodo` no se cruzan: filtrar por evento no cambia el período de venta. ✅ |
| 3 | La fila `TOTAL` de `history` sale como campo aparte, no dentro de la serie. ✅ |
| 3 | `history` con más de 60 días marca `truncated`. ✅ |
| 3 | `medios_de_pago` normaliza `total_revenue` cuando viene como string. ✅ |
| 3 | `disponibilidad` con más de 12 funciones falla con mensaje recuperable. ✅ |
| 3 | `disponibilidad` rechaza `"todos"`. ✅ |
| 4 | `date=last_month` con 504 vuelve al modelo como texto, no como error de la petición. ✅ |
| 4 | Ningún importe aparece en la línea de log. ✅ |

---

## 11. Qué pedirle al equipo de backend

Por orden de valor para el agente:

1. **`/stats` con desglose por id.** Desbloquea el ranking sin construir el
   snapshot. Es la diferencia entre una fase 2 de una semana y una de un día.
2. **Arreglar `date=last_month`.** Hoy rompe la app y va a romper al agente.
3. **Id de evento padre en `event-list`.** Elimina la agrupación por nombre, que
   fusiona eventos homónimos.
4. **Estado comercial en `event-list`.** Hoy no se sabe si un evento está
   cancelado, agotado o pausado, y por eso el agente tiene prohibido afirmarlo.
5. **Endpoint liviano de validación de sesión.** Deuda anterior: sin él, la
   caché de catálogo es el único parche.
