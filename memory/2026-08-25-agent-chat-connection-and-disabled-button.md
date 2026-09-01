# Debug report: conexión del agente y botón deshabilitado

- **Síntomas:** iOS Simulator mostraba un error de conexión aunque Node estaba
  iniciado; con el campo vacío, el botón `Enviar` se veía blanco sobre el fondo.
- **Causa de conexión:** la app priorizaba la IP de Metro para todas las
  plataformas. En iOS Simulator intentaba llegar a esa IP, mientras Node sólo
  escuchaba en `127.0.0.1:8787`.
- **Causa visual:** el estado deshabilitado mantenía fondo azul y contenido
  blanco, pero aplicaba opacidad al control completo, dejando el fondo casi
  imperceptible.
- **Corrección:** iOS Simulator usa `127.0.0.1:8787`, Android Emulator usa
  `10.0.2.2:8787` y una URL explícita conserva prioridad. El botón deshabilitado
  ahora tiene fondo, borde y texto grises; al escribir vuelve a mostrarse azul.
- **Regresión:** se agregaron cuatro pruebas para la resolución de URL.
- **Validación:** `curl /health` respondió `{ "ok": true }`, TypeScript sin
  errores, lint sin errores nuevos y 30 pruebas aprobadas.
- **Estado:** DONE.
