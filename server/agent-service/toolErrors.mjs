/**
 * Errores de entrada de una tool: los provoca el modelo al completar mal los
 * parámetros, y son recuperables. La `errorFunction` del agente los devuelve
 * como texto para que el modelo corrija y reintente.
 *
 * Todo lo demás (backend caído, timeout, sesión vencida) NO es esto: sube y
 * termina la petición con el status que corresponda. Un modelo no puede
 * "corregir" que el backend de reportes esté abajo.
 */
export class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolInputError";
  }
}
