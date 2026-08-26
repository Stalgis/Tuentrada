import { createHash } from "node:crypto";
import {
  ReportAuthenticationError,
  ReportTimeoutError,
} from "./reportApiClient.mjs";

export class AuthenticationError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthenticationError";
  }
}

const extractBearerToken = (request) => {
  const authorization = request.headers.authorization ?? "";
  const [scheme, token, extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    throw new AuthenticationError();
  }

  return token;
};

export const tokenFingerprint = (token) =>
  createHash("sha256").update(token).digest("hex").slice(0, 16);

/**
 * La validación ocurre contra el backend real antes de invocar a OpenAI.
 * El token nunca entra al prompt, a los parámetros de tools ni a los logs:
 * fuera de acá sólo circula el fingerprint.
 *
 * El fingerprint sale al llamador porque también es la clave de la caché de
 * catálogo, del límite por sesión y del historial de conversación.
 */
export const createUpstreamAuthenticator = ({ createReports }) =>
  async (request) => {
    const token = extractBearerToken(request);
    const fingerprint = tokenFingerprint(token);
    const reports = createReports(token, fingerprint);

    try {
      await reports.validateAccess();
    } catch (error) {
      if (error instanceof ReportAuthenticationError) {
        throw new AuthenticationError("La sesión venció o no es válida.");
      }
      if (error instanceof ReportTimeoutError) {
        error.httpStatus = 504;
        error.publicMessage = "El backend de reportes tardó demasiado en responder.";
      }
      throw error;
    }

    return {
      user: { id: `session-${fingerprint}` },
      reports,
      fingerprint,
    };
  };

export const createDemoAuthenticator = ({ expectedToken, reports }) =>
  async (request) => {
    const token = extractBearerToken(request);
    if (token !== expectedToken) throw new AuthenticationError();
    const fingerprint = tokenFingerprint(token);
    return { user: { id: "demo-user" }, reports, fingerprint };
  };
