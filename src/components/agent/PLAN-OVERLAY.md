# Plan: el agente como capa flotante

Estado: plan aprobado, sin implementar.
Reemplaza la navegación a `AgentChat` como pantalla por una capa sobre la
pantalla actual, abierta y cerrada por el mismo botón.

## Decisiones tomadas

| # | Decisión | Elegida |
|---|---|---|
| D1 | Arquitectura | Overlay propio en la capa de Tabs, no ruta modal |
| D2 | Forma | Casi completa, con franja atenuada arriba que también cierra |
| D3 | El botón mientras está abierto | Viaja a la esquina superior derecha mientras gira |

---

## 1. Por qué, más allá de lo estético

Hoy `AgentChat.tsx` hace `useRef(newConversationId())`: **un hilo nuevo en cada
montaje**. El usuario mira el dashboard, pregunta, vuelve, entra de nuevo, y el
agente no se acuerda de nada.

El servicio guarda historial por conversación con TTL de 30 minutos
([conversationStore.mjs](../../../server/agent-service/conversationStore.mjs)).
Esa memoria hoy se descarta en cada navegación.

Una capa que no se desmonta la hace valer, y encaja con el uso real: mirás un
número, preguntás, cerrás, mirás otro, volvés a preguntar. Eso es **una**
conversación, no cinco.

Ese es el argumento fuerte. El gesto lindo viene de regalo.

---

## 2. Anatomía de la interacción

```
CERRADO                          ABIERTO
┌───────────────────┐            ┌───────────────────┐
│                   │            │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒(X)│ ← franja atenuada:
│   Dashboard       │            ├───────────────────┤   deja ver el dashboard
│                   │            │                   │   y cierra al tocarla
│                   │    →       │   Conversación    │
│                   │            │                   │
│            ( 💬 ) │            │  [ input    ]  (↑)│ ← el enviar del composer
│  ┌─────────────┐  │            │                   │   queda solo en su esquina
│  │  tab bar    │  │            └───────────────────┘
└──┴─────────────┴──┘
```

El botón es **el mismo componente** en los dos estados. Lo que cambia es su
posición y su ícono, y las dos cosas las maneja un único shared value.

---

## 3. Arquitectura

**Se mueve el contenido, no la lógica.** `AgentChat.tsx` se parte en dos:

- `AgentConversation.tsx` — la conversación pura: mensajes, composer, estado.
  Es el archivo actual sin el `SafeAreaView` ni el `AppHeader`.
- `AgentOverlay.tsx` — la capa: scrim, animación de entrada, foco, bloqueo de
  toques, y el `conversationId` que ahora vive acá porque es lo que sobrevive.

`AgentFloatingButton` deja de recibir `onOpenAgent` y pasa a recibir `open` y
`onToggle`: ya no navega, sólo informa.

En [RootNavigator.tsx:126](../../navigation/RootNavigator.tsx) el bloque queda:

```
<View style={{ flex: 1 }}>
  <Tab.Navigator ... />
  <AgentOverlay open={open} onClose={...} />      ← debajo del botón
  <AgentFloatingButton open={open} onToggle={...} />
</View>
```

El orden importa: el botón se declara último para quedar por encima de la capa.

**La ruta `AgentChat` se conserva.** No cuesta nada y mantiene el deep link
vivo; ambas superficies renderizan `AgentConversation`. Si mañana llega una
notificación con link al agente, sigue funcionando.

---

## 4. Los tres puntos que se complican, y cómo se resuelven

### 4.1 Botón atrás de Android
Hoy `AgentChat` es una ruta y el back funciona gratis. Como capa hay que
cablearlo: `BackHandler.addEventListener("hardwareBackPress")` mientras
`open`, devolviendo `true` para consumir el evento y cerrar.

**Hoy `BackHandler` no se usa en ningún lado de la app**, así que es un patrón
nuevo. Sin esto, en Android el back sale de la app en vez de cerrar el chat.

### 4.2 El teclado
La capa es dueña del alto útil (todo menos la franja), así que el
`KeyboardAvoidingView` actual sigue sirviendo sin cambios. Es la razón principal
por la que D2 descartó la hoja parcial.

Lo único a revisar: la capa se posiciona con `insets`, no con `SafeAreaView`,
porque tiene que poder pintar por debajo de la barra de tabs.

### 4.3 Accesibilidad
Una capa no es una pantalla: sin marcarla, VoiceOver sigue leyendo el dashboard
de atrás. Hace falta:

- `accessibilityViewIsModal` en el contenedor de la capa
- mover el foco al abrir, y devolverlo al botón al cerrar
- la franja atenuada con `accessibilityLabel="Cerrar el agente"` y rol de botón
- el botón anunciando su estado con `accessibilityState={{ expanded: open }}`

---

## 5. Movimiento

Un solo `progress` de 0 a 1 maneja todo. Se respeta `useReducedMotion`, que el
componente ya consulta.

| Elemento | 0 (cerrado) | 1 (abierto) |
|---|---|---|
| Capa | `translateY: 24`, opacidad 0 | `translateY: 0`, opacidad 1 |
| Scrim de la franja | transparente | negro al 50% |
| Botón: posición | abajo derecha | arriba derecha, `insets.top + 8` |
| Botón: ícono | `message-circle` | `x` |

**Tiempos:** entrada con spring de ~280ms; salida a ~180ms, que es el 64% de la
entrada. Salir más rápido que entrar hace que la interfaz se sienta suelta.

**El cambio de ícono** es un cross-fade con rotación de 90°, no un swap seco: el
`message-circle` se desvanece rotando mientras la `X` aparece. Los dos íconos
viven apilados en el mismo contenedor.

**La animación es interrumpible:** tocar el botón a mitad de la apertura tiene
que revertir desde donde está, no esperar a que termine.

---

## 6. Riesgo real: la capa que no se desmonta

La propiedad que hace valiosa esta arquitectura (nada se destruye) es también su
único riesgo serio: **si un usuario cierra sesión y entra otro sin que la capa
se desmonte, el segundo vería los mensajes del primero.**

El servidor está a salvo: el historial se guarda con clave
`fingerprintDelToken:conversationId`, así que otro token nunca lee esa
conversación. El riesgo es puramente local, en el array `messages` de la capa.

En teoría el cierre de sesión desmonta todo el stack autenticado, así que no
debería pasar. **Hay que verificarlo, no suponerlo**, y de paso atar la capa a
`sessionGeneration`: cuando cambia, se vacían los mensajes y se genera un
`conversationId` nuevo. Son tres líneas y cierran la duda para siempre.

Es exactamente el mismo patrón de generación de sesión que ya usa el resto de la
app.

---

## 7. Orden de implementación

1. **Partir `AgentChat` en `AgentConversation` + cáscara.** Sin cambios de
   comportamiento; los 223 tests tienen que seguir en verde. Es el paso que
   habilita todo lo demás.
2. **`AgentOverlay` estático**, sin animación: aparece y desaparece. Acá se
   resuelven scrim, teclado, `accessibilityViewIsModal`, `BackHandler` y el
   reset por `sessionGeneration`.
3. **El botón viajero.** Un `progress` compartido entre capa y botón, con el
   cross-fade de íconos y los tiempos de la sección 5.
4. **Sacar la entrada desde Perfil**, ya redundante, y verificar que la ruta
   `AgentChat` siga funcionando para deep links.

Los pasos 1 y 2 ya dan la feature completa y usable. El 3 es el que la hace
verse bien.

---

## 8. Qué NO entra

- **Hoja parcial arrastrable.** Descartada en D2: el teclado la lleva a
  pantalla completa apenas escribís.
- **Gesto de deslizar para cerrar.** El botón y la franja ya son dos salidas.
  Se puede sumar después sin tocar nada de esto.
- **Burbuja arrastrable por la pantalla.** Choca con el scroll y con los gestos
  del sistema en los bordes.
- **Badge de no leídos.** No hay mensajes que lleguen solos: el agente sólo
  responde cuando le preguntás.
