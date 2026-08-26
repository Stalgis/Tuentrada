# Cómo probar el agente

## Antes de empezar: qué está probado y qué no

**Probado (197 tests automáticos):** toda la lógica del servicio contra backends
falsos. Agrupación de eventos, refs, los dos ejes temporales, traducción de
campos, cálculo de variaciones y porcentajes, topes, errores.

**NO probado:** que las respuestas del backend real tengan la forma que
asumimos. Esos supuestos salen de leer el cliente de la app
(`src/lib/reportApi.ts`), así que están bien fundados, pero nadie los corrió
contra el servidor de verdad. **Es el riesgo número uno de esta entrega** y es
justo lo que sólo podés verificar vos.

Si algo falla, lo más probable es que sea eso, no la lógica.

---

## Paso 0 — arrancar

```bash
npm run agent:server
```

**Tiene que imprimir, en este orden:**

```
Modelo verificado: gpt-5.6-terra
Agent service listening on http://127.0.0.1:8787
POST /api/agent/chat
Datos: catálogo real | Herramientas: sólo lectura
Topes: 1000000 tokens/día | 25 consultas backend/petición | 6 turnos | timeout 25000ms | toolCalls al cliente: false
```

**Si dice `El modelo "gpt-5.6-terra" no existe o la cuenta no tiene acceso`:**
el arranque se detiene a propósito. Poné en `.env` un `OPENAI_AGENT_MODEL` que
tu cuenta sí tenga. Sin esto no sigue nada.

**Si dice `OPENAI_API_KEY rechazada por OpenAI`:** la key del `.env` no sirve.

Después, en otra terminal:

```bash
npm start
```

Iniciá sesión con un usuario real y andá a **Perfil → Agente beta → Probar agente**.

> Si estás en un teléfono físico, primero agregá a `.env`:
> `AGENT_SERVICE_HOST=0.0.0.0` y `EXPO_PUBLIC_AGENT_API_URL=http://TU_IP_LAN:8787`

---

## Los 14 checks

Dejá la terminal del servicio a la vista: cada pregunta escribe una línea de log
que dice qué pasó de verdad.

### Catálogo

**1. Contar eventos, no funciones** ← el bug que motivó el paso 1

> ¿Cuántos eventos tengo?

✅ Un número que coincide con los eventos que ves en la app (nombres distintos).
✅ Si un evento tuyo tiene varias fechas, lo nombra una vez y dice cuántas funciones tiene.
❌ Un número mucho más grande que el de la app: está contando funciones.

**2. Filtro temporal por fecha de evento**

> ¿Qué eventos tengo este mes?

✅ Sólo eventos con alguna función en el mes. Si un evento tiene 4 funciones y
sólo 2 caen en el mes, tiene que decirlo.
❌ Lista todo sin filtrar, o inventa fechas.

**3. Eventos sin fecha**

Sólo aplica si tenés eventos sin fecha cargada.

✅ Menciona que hay N eventos sin fecha que no pudo evaluar.
❌ Los omite en silencio.

**4. Memoria conversacional** ← el motivo del historial

> ¿Cuántos eventos tengo?

y después, sin repetir el contexto:

> ¿y la semana que viene?

✅ Entiende que seguís hablando de eventos.
❌ Pregunta "¿la semana que viene de qué?".

### Ventas

**5. Total de la cuenta**

> ¿Cuánto vendí este mes?

✅ Da recaudación y entradas, **y nombra el período** ("este mes").
✅ El número coincide con el dashboard de la app para el mismo período.
❌ No dice de qué período habla. ❌ No coincide con la app.

**6. La trampa de los dos ejes** ← lo más importante de probar

> ¿Cuánto vendí de los eventos de este mes?

Es distinto del check 5: acá "este mes" filtra **cuándo ocurren los eventos**,
y las ventas son de todo el histórico.

✅ Busca los eventos del mes y después pide sus ventas sin filtro de venta.
❌ Da el mismo número que el check 5.

En el log, la línea tiene que mostrar `buscar_eventos` con `periodo: "este_mes"`
y después `resumen_de_ventas` con `periodoDeVenta: "todo"`.

**7. Ventas de un evento puntual**

> ¿Cuánto vendió [nombre de un evento tuyo]?

✅ El número coincide con el de ese evento en la app.
❌ Da el total de la cuenta, o números de otro evento.

**8. Invitaciones ≠ vendidas** ← la trampa de los nombres

> ¿Cuántas entradas vendí en total y cuántas fueron invitaciones?

✅ Dos números distintos y claros.
❌ Suma invitaciones dentro de "vendidas".

**9. Comparación** ← el modelo no debe hacer cuentas

> ¿Cómo vengo este mes comparado con el mes pasado?

✅ Da los dos números y la variación.
✅ Si el mes pasado fue cero, dice que fue cero en vez de dar un porcentaje.
❌ Un porcentaje que no cierra con los números que dio.

> ⚠️ Si acá sale un error diciendo que `mes_pasado` no está disponible y
> ofreciendo otro período, **eso es correcto**: es el bug conocido del backend
> (504 en `date=last_month`) manejado a propósito.

**10. Evolución diaria**

> ¿Qué día vendí más este mes?

✅ Una fecha en formato claro y su recaudación.
✅ Las fechas se ven bien (no "05/03/2026" ambiguo).
❌ Fechas invertidas (día por mes) o un día que no existe.

**11. Medios de pago**

> ¿Con qué medios de pago me compran?

✅ Ordenados de mayor a menor, con porcentajes que suman ~100.
❌ Porcentajes que no cierran.

**12. Disponibilidad**

> ¿Cuántas entradas me quedan en [nombre de un evento con pocas funciones]?

✅ Disponibles por sector, comparable con la pantalla de Sectores de la app.
✅ Si menciona "otros estados", está bien: son localidades en estados que el
backend no explica y que la app tampoco interpreta.
❌ Números que no coinciden con la pantalla de Sectores.

Con un evento de muchas funciones (más de 12) va a decir que no puede. **Eso es
correcto** y queda anotado en `limites`.

**13. Lo que NO debe poder**

> ¿Cuál de mis eventos vendió más?

✅ Explica que todavía no puede rankear y ofrece el total o el detalle de uno.
❌ **Inventa un ranking.** Esto es un fallo grave: significa que está usando
datos que no pidió.

> ¿Está cancelado el evento X?

✅ Dice que ese dato no está disponible.
❌ Afirma un estado.

### Sesión y errores

**14. Sesión vencida**

Cerrá sesión en la app desde otro lado (o esperá a que venza) y mandá una
pregunta.

✅ La app te saca a login, como con cualquier otra pantalla.
❌ El error aparece como una burbuja del asistente y seguís "adentro".

---

## Qué leer en el log

Cada pregunta escribe una línea así:

```json
{"evento":"agent_request","requestId":"...","sesion":"...","status":200,
 "durationMs":3400,"turnos":2,"upstream":3,
 "usage":{"totalTokens":2100},
 "toolCalls":[{"toolName":"resumen_de_ventas","parameters":{...}}]}
```

Qué mirar:

| Campo | Verde | Rojo |
|---|---|---|
| `status` | 200 | 500 (bug), 502 (turnos agotados), 503 (tope de consultas) |
| `durationMs` | < 10000 | cerca de 25000: está por dar timeout |
| `turnos` | 1 a 4 | 6 seguido: `AGENT_MAX_TURNS` quedó corto |
| `upstream` | 1 a 5 | cerca de 25: la pregunta es muy cara |
| `toolCalls` | los parámetros son los que esperabas | `periodo` y `periodoDeVenta` cruzados |
| `limites` | `null` | una guarda se activó; ver abajo |

**Contar cuántas veces se topea disponibilidad** (eventos con más de 12
funciones, que en un catálogo real son varios):

```bash
grep -c '"tipo":"funciones_disponibilidad"' agent.log
```

No es un error: el tope hace lo que debe. Es la evidencia para decidir si vale
la pena construir el snapshot de la fase 2.

**`toolCalls` es el campo más útil.** Te muestra cómo el modelo interpretó la
pregunta. Si una respuesta te suena mal, mirá ahí primero: casi siempre el
problema es que eligió el parámetro equivocado, no que el dato esté mal.

---

## Los 4 supuestos sobre el backend real

Son los que sólo se validan corriendo esto de verdad. Si un check falla, mirá
acá antes que nada.

| Supuesto | Dónde se rompe | Cómo se ve |
|---|---|---|
| `/stats` devuelve `tickets`, `invitations`, `total_tickets`, `total`, `unique_buyers` | check 5 | Todo en cero aunque tengas ventas |
| `/history` trae una fila con `day_formatted: "TOTAL"` | check 10 | El total no coincide con la suma de los días |
| `/payments` manda `total_revenue` (a veces string) | check 11 | Porcentajes en cero o `null` |
| `/online-sales` usa `available`, `purchase`, `invitation`, `kill`, `promoter_blocked` | check 12 | Disponibles en cero, u "otros estados" enorme |

Si alguno falla, mandame la línea de log de esa pregunta y el JSON crudo que
devuelve ese endpoint. El arreglo es de traducción, no de arquitectura.

---

## Aprobado al 100% cuando

- [ ] El arranque imprime el modelo verificado y los cuatro topes
- [ ] Checks 1 a 4: catálogo y memoria
- [ ] Checks 5 a 9: totales, los dos ejes, invitaciones y comparación
- [ ] Checks 10 a 12: evolución, pagos y disponibilidad coinciden con la app
- [ ] Check 13: **no inventa un ranking ni un estado de evento**
- [ ] Check 14: la sesión vencida te saca a login
- [ ] Ninguna línea de log con `status: 500`
- [ ] Los números coinciden con lo que muestra la app para el mismo período

El check 13 es el que no se negocia. Un dato que falta es un problema menor; un
dato inventado con confianza sobre plata es el único fallo que rompe la
confianza del usuario para siempre.
