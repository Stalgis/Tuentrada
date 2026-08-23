export class AuthenticationError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Autenticación deliberadamente simple para aprender el flujo del servicio.
 * En producción, esta función deberá validar el token con el backend de Tuentrada
 * y devolver la identidad real asociada a él.
 */
export const authenticateRequest = (request, expectedToken) => {
  const authorization = request.headers.authorization ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || token !== expectedToken) {
    throw new AuthenticationError();
  }

  // Este id nace de la autenticación, nunca del body ni de una tool call.
  return { id: "demo-user" };
};
