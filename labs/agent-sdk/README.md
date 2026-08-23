# Laboratorio de OpenAI Agents SDK

Este laboratorio muestra el flujo de un agente analítico sin conectarlo todavía
a la app Expo ni al backend real.

## Qué demuestra

- Un usuario autenticado queda fijado por el servidor (`demo-user`).
- El agente solamente recibe herramientas de lectura.
- Las herramientas filtran datos por propietario.
- Los totales, diferencias y porcentajes se calculan en código determinista.
- El modelo interpreta y explica; no calcula ni consulta la base directamente.

El dataset incluye deliberadamente un evento de otro usuario. Ninguna herramienta
permite acceder a ese evento desde la sesión `demo-user`.

## Probar sin API

```bash
npm run agent:lab
```

También se puede enviar una sola pregunta:

```bash
npm run agent:lab -- "¿Cuánto vendió Noche Neón esta semana?"
```

Este modo usa un enrutador simulado para enseñar qué herramienta se invoca. No
consume tokens y no usa un modelo de OpenAI.

## Probar con Agents SDK

La clave debe existir solamente en un proceso de servidor, nunca en variables
`EXPO_PUBLIC_*` ni en el código de React Native. Los scripts del laboratorio
cargan automáticamente el `.env` local cuando existe.

```bash
npm run agent:lab:live -- "Compará Festival Horizonte con Noche Neón esta semana"
```

En un servidor real, configurá `OPENAI_API_KEY` mediante el gestor de secretos
de la plataforma en lugar de depender de un archivo `.env`.

El modelo se puede cambiar sin editar código:

```bash
export OPENAI_AGENT_MODEL="gpt-5.6-terra"
```

## Archivos

- `eventData.mjs`: datos ficticios, permisos y cálculos.
- `mockAgent.mjs`: simulador local del enrutamiento.
- `liveAgent.mjs`: agente y herramientas reales del SDK.
- `cli.mjs`: punto de entrada de consola.

## Camino hacia producción

1. Mover `liveAgent.mjs` a un servicio backend Node.js 22 o superior.
2. Reemplazar `eventData.mjs` por un cliente autenticado del backend de reportes.
3. Derivar `ownerId` de la sesión validada, nunca del texto o cuerpo controlado
   por el usuario.
4. Agregar límites, timeouts, guardrails y pruebas con preguntas representativas.
5. Exponer un endpoint de chat y conectar la pantalla Expo únicamente a ese
   endpoint.
