# Beta del agente: dos testers iOS

El perfil `testflight` de `eas.json` genera una build para App Store Connect,
con incremento automático del número de build y el agente conectado a
https://tuentrada-agent.onrender.com. Las notificaciones remotas quedan
deshabilitadas en esta beta. No requiere Firebase.

## Preparación y distribución

1. Confirmar en el entorno **production** del proyecto EAS las variables de la
   app: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_BASE_URL` y `EXPO_PUBLIC_API_KEY`.
   El archivo `.env` local no demuestra que estén configuradas en EAS.
   `EXPO_PUBLIC_SENTRY_DSN` es opcional. La URL del agente ya está en el perfil.
   La clave `OPENAI_API_KEY` se guarda únicamente en Render.
2. Ejecutar desde la raíz:

   ```sh
   npx eas-cli build --platform ios --profile testflight
   ```

3. Subir esa build seleccionando su ID exacto:

   ```sh
   npx eas-cli submit --platform ios --profile testflight --id <BUILD_ID>
   ```

4. Instalarla primero en un iPhone propio y completar la prueba siguiente.
5. En App Store Connect → Tuentrada → TestFlight, seleccionar esa build y
   crear un grupo para los dos testers. Si son externos, completar la revisión
   beta y proporcionar a Apple acceso de demostración con datos de prueba.
   Invitar a los testers cuando esté aprobada. Subir a TestFlight no publica
   la app en el App Store.

## Verificación antes de invitar

- El login funciona y aparece el botón del agente.
- Preguntar por ventas de un período conocido y contrastar entradas,
  invitaciones e importes con los reportes de la app.
- Comparar dos períodos y consultar disponibilidad de un evento conocido.
- Hacer una repregunta y luego iniciar una conversación nueva.
- Cancelar una consulta, probar sin conexión y volver a consultar.
- Cerrar sesión y entrar con otra cuenta: no deben aparecer mensajes ni datos
  de la anterior.
- Ejecutar las pruebas y las evaluaciones completas del agente antes de la
  entrega; revisar las respuestas además de su resultado automático:

  ```sh
  npm test
  npm run agent:eval -- --live
  ```

Render Free puede suspender el servicio entre usos. Para una prueba coordinada,
abrir `/health` y esperar `ok: true` antes de empezar. Si el servidor estaba
dormido, la primera consulta puede agotar el timeout; reintentar una vez que
esté disponible. Esto no valida disponibilidad continua.

## Texto para «Qué probar»

Probá el agente con cinco preguntas que harías en tu trabajo habitual:
ventas, comparación entre períodos, eventos y disponibilidad. Contrastá las
cifras con los reportes y probá una repregunta dentro de la misma conversación.

Contanos:

- ¿Qué preguntaste y qué esperabas obtener?
- ¿La respuesta fue correcta y te ahorró tiempo?
- ¿Qué pregunta importante no pudo resolver?
- ¿Lo usarías regularmente? ¿Qué le falta para adoptarlo?

Si hay un problema, adjuntá una captura, la hora aproximada y la referencia
que aparece en el chat, si está disponible. No incluyas contraseñas ni tokens.

## Estado

Este documento es una guía de entrega, no evidencia de que los pasos manuales
ya se completaron. La configuración local no confirma firma, build remota,
aprobación de Apple ni exactitud de respuestas con cuentas reales.

Referencias: [perfiles EAS](https://docs.expo.dev/build/eas-json/),
[TestFlight](https://developer.apple.com/testflight/).
