# Servicio Node del agente

Esta primera versión enseña la separación entre HTTP, autenticación, ejecución
del agente y acceso a reportes. Usa datos ficticios, pero realiza una llamada
real a OpenAI.

## Arquitectura

```text
POST /api/agent/chat
        │
        ├── auth.mjs              valida el Bearer token y obtiene el usuario
        ├── httpServer.mjs        valida HTTP, JSON, tamaño y timeout
        ├── agent.mjs             ejecuta el Agents SDK con RunContext
        └── demoReportClient.mjs  accede a los datos ficticios
```

El `user.id` no forma parte de los parámetros de las herramientas. Nace de la
autenticación y viaja en el contexto local de la ejecución.

## Ejecutar

El `.env` local debe contener:

```dotenv
OPENAI_API_KEY=...
AGENT_DEMO_TOKEN=un-token-local
```

Iniciar el servidor:

```bash
npm run agent:server
```

En otra terminal, comprobar su salud:

```bash
curl http://127.0.0.1:8787/health
```

Enviar una pregunta:

```bash
curl \
  -X POST \
  http://127.0.0.1:8787/api/agent/chat \
  -H "Authorization: Bearer un-token-local" \
  -H "Content-Type: application/json" \
  -d '{"message":"Compará Festival Horizonte con Noche Neón esta semana"}'
```

La respuesta contiene el texto y, por ahora, las herramientas utilizadas para
que podamos inspeccionar el aprendizaje:

```json
{
  "answer": "Festival Horizonte lidera...",
  "toolCalls": [
    {
      "toolName": "comparar_eventos",
      "parameters": {
        "eventoA": "Festival Horizonte",
        "eventoB": "Noche Neón",
        "periodo": "this_week"
      }
    }
  ]
}
```

## Qué es demostrativo

- `AGENT_DEMO_TOKEN` representa temporalmente la autenticación real.
- `demoReportClient.mjs` representa temporalmente al backend de reportes.
- `toolCalls` se devuelve para aprendizaje; en producción se registraría de
  forma segura y normalmente no se enviaría a la app.

## Próximo reemplazo

La siguiente iteración sustituirá `DemoReportClient` por un `ReportApiClient`
que llame al backend real con la identidad autenticada. El servidor HTTP y el
agente no deberían necesitar cambios estructurales.
