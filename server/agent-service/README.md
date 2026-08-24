# Servicio Node del agente

Esta fase conecta una única herramienta de solo lectura al catálogo real del
usuario autenticado. Todavía no consulta ventas, recaudación, pagos ni sectores.

## Flujo

```text
Expo AuthProvider
  -> Authorization: Bearer <accessToken>
  -> POST /api/agent/chat
  -> validación contra /api/v2/report/event-list
  -> ReportApiClient ligado a esa sesión
  -> RunContext local
  -> tool buscar_eventos
  -> respuesta del agente
```

El token no forma parte del prompt, de los parámetros de la herramienta ni de
la respuesta. Antes de gastar una llamada a OpenAI, el servicio verifica que el
backend real acepte la sesión.

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

## Probar desde Expo

1. Iniciar el servicio:

   ```bash
   npm run agent:server
   ```

2. Iniciar o recargar Expo después de cambiar variables `EXPO_PUBLIC_*`.
3. Iniciar sesión con un usuario real.
4. Abrir **Perfil -> Agente beta -> Probar agente**.
5. Preguntar `¿Cuántos eventos tengo?` o buscar un evento por nombre.

La respuesta incluye temporalmente `toolCalls` en el JSON para facilitar la
inspección. La pantalla no muestra esos detalles.

## Límites intencionales

- Una sola herramienta: `buscar_eventos`.
- Máximo 30 eventos por resultado enviado al modelo.
- El modelo recibe nombre, fecha y estado; no recibe el token ni información de
  compradores.
- El catálogo se obtiene una vez por petición y se reutiliza entre validación y
  tool call.
- Un 401/403 upstream evita la llamada a OpenAI.

## Próximo paso

Después de verificar varios usuarios y cuentas, agregar una herramienta real de
estadísticas con cálculos deterministas y pruebas de aislamiento equivalentes.
