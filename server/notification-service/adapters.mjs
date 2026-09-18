import { createHash } from "node:crypto";
import { z } from "zod";
import { timezoneSchema } from "../../shared/notifications.ts";

export const identitySchema = z.object({
  accountId: z.string().trim().min(1).max(200),
  userId: z.string().trim().min(1).max(200),
  timezone: timezoneSchema,
  expiresAt: z.iso.datetime({ offset: true }),
});
export class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bearer = request => {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.authorization ?? "");
  if (!match) throw new ServiceError(401, "Iniciá sesión para continuar.");
  return match[1];
};
export const createIdentityAdapter = ({ url, apiKey, fetchImpl = fetch }) => async (request, signal) => {
  const token = bearer(request);
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
    signal, redirect: "error",
  });
  if (response.status === 401 || response.status === 403) throw new ServiceError(401, "La sesión venció o no es válida.");
  if (!response.ok) throw new ServiceError(502, "No se pudo validar la sesión.");
  const parsed = identitySchema.safeParse((await response.json()).data);
  if (!parsed.success) throw new ServiceError(502, "La respuesta de identidad no es válida.");
  if (Date.parse(parsed.data.expiresAt) <= Date.now()) throw new ServiceError(401, "La sesión venció.");
  return { ...parsed.data, sessionId: createHash("sha256").update(token).digest("hex") };
};
export const createSourceAdapter = ({ url, serviceToken, fetchImpl = fetch }) => async input => {
  const response = await fetchImpl(url, {
    method: "POST", headers: { Authorization: `Bearer ${serviceToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input), signal: AbortSignal.timeout(20_000), redirect: "error",
  });
  if (!response.ok) throw new ServiceError(502, "No se pudo generar el informe.");
  return (await response.json()).data;
};
export const createExpoTransport = ({ accessToken, fetchImpl = fetch } = {}) => {
  const post = async (path, body) => {
    let response;
    try {
      response = await fetchImpl(`https://exp.host/--/api/v2/push/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: "error",
      });
    } catch {
      // No sabemos si Expo llegó a recibir el envío. Guardar como incierto
      // evita duplicarlo; los errores HTTP explícitos sí pueden reintentarse.
      throw Object.assign(new Error("Expo no respondió"), { ambiguous: true });
    }
    if (!response.ok) throw Object.assign(new Error("Expo rechazó la solicitud"), { retryable: response.status === 429 || response.status >= 500 });
    let json;
    try { json = await response.json(); }
    catch { throw Object.assign(new Error("Respuesta inválida de Expo"), { ambiguous: true }); }
    if (!json.data) throw Object.assign(new Error("Respuesta inválida de Expo"), { ambiguous: true });
    return json.data;
  };
  return {
    send: async message => {
      const data = await post("send", [message]);
      if (!Array.isArray(data) || data.length !== 1 || !["ok", "error"].includes(data[0]?.status) ||
          (data[0].status === "ok" && typeof data[0].id !== "string")) {
        throw Object.assign(new Error("Ticket inválido"), { ambiguous: true });
      }
      return data[0];
    },
    receipts: ids => post("getReceipts", { ids }),
  };
};
