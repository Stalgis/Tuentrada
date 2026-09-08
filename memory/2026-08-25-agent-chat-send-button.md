# Debug report: botón de envío del agente

- **Síntoma:** el usuario no identificaba un botón para enviar la pregunta.
- **Causa:** el control era un círculo con una flecha, sin etiqueta visible, y
  comenzaba deshabilitado al 40% de opacidad. Android tampoco ajustaba el
  compositor al abrir el teclado.
- **Corrección:** botón con texto `Enviar`, ícono `send`, mayor contraste y
  `KeyboardAvoidingView` con comportamiento `height` en Android.
- **Archivo:** `src/screens/AgentChat.tsx`.
- **Validación:** TypeScript sin errores, lint sin errores nuevos y 26 pruebas
  aprobadas.
- **Estado:** DONE.
