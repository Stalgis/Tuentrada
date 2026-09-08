# Seis P1 del agente — investigación y correcciones

Fecha: 2026-08-26

## Síntomas

- La autenticación podía consultar reportes antes de aplicar presupuesto, rate limit y concurrencia.
- Payloads financieros HTTP 200 inválidos terminaban convertidos en ceros o listas vacías.
- `refs: []` ampliaba el alcance a toda la cuenta.
- `mejorDia` ignoraba días anteriores al recorte de 60 días.
- Cancelar el fetch móvil no abortaba el run del servidor y podía guardar historial invisible.
- Los tokens consumidos por runs fallidos no entraban al presupuesto diario.

## Causas raíz

1. Las guardas dependientes de sesión y las globales estaban unidas en una sola operación ejecutada después de autenticar.
2. El cliente de reportes usaba fallbacks (`null`/`[]`) sin validar el contrato exitoso del backend.
3. `null` y array vacío compartían una rama aunque tienen semánticas distintas.
4. El máximo se calculaba sobre `dias` después de `slice(-60)`.
5. Sólo existía un timeout interno; no había enlace entre el cierre del socket, el Agent SDK y los fetch de reportes.
6. El uso del SDK se leía sólo del resultado exitoso, no de `AgentsError.state.usage`.

## Correcciones

- Admisión global pre-auth (presupuesto, concurrencia y rate global) separada del límite por fingerprint.
- Validación estricta de `stats`, `history`, `payments` y `online-sales`; contrato inválido sale como 502.
- Sólo `refs: null` significa toda la cuenta; `[]` es un error recuperable sin consultas financieras.
- `mejorDia` se calcula sobre la serie completa y luego se recorta la lista visible.
- El cierre del cliente aborta el run, propaga la señal a reportes, evita persistir historial y registra status 499 sólo en logs.
- El uso de errores del SDK se conserva y se contabiliza en `finally`, incluso en timeout o límite de turnos.

## Verificación

- Regresiones específicas agregadas para los seis casos.
- `npm test`: 223/223.
- `npx tsc --noEmit`: correcto.
- `npm run lint`: sin errores; conserva dos warnings preexistentes en `SectorScreen.tsx`.
- `git diff --check`: correcto.
