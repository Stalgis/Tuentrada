# FAB del agente no visible

Fecha: 2026-08-26

## Síntoma

El botón flotante agregado para abrir `AgentChat` no aparecía en el dashboard del simulador.

## Investigación

- `isAgentAvailable()` devuelve una URL local para iOS cuando `__DEV__` es verdadero.
- Metro corre desde `/Users/tomas/Documents/Tuentrada` en el puerto 8081.
- El bundle actual contiene `AgentFloatingButton`, `Abrir acceso al agente` y su import desde `RootNavigator`.
- La primera captura mostraba la app autenticada sin el componente; al abrir nuevamente el manifiesto actual de Expo, la app se recargó y volvió a Login.

## Causa raíz

Expo Go mantenía cargado un bundle anterior. No era un fallo de la condición de disponibilidad ni una ausencia del componente en el bundle actual.

## Acción

Se forzó la recarga mediante la URL local del proyecto `exp://127.0.0.1:8081`.

## Verificación

- Bundle actual verificado: contiene `AgentFloatingButton`.
- `npx tsc --noEmit`: correcto.
- Suite previa tras la implementación: 223/223.
- La verificación visual post-login queda pendiente porque la recarga cerró la sesión y no se utilizaron credenciales del usuario.

Estado: DONE_WITH_CONCERNS
