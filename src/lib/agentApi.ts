import { Platform } from "react-native";
import { env } from "./env";
import { resolveAgentApiUrl } from "./agentApiUrl";
import { AgentApiError, interpretAgentResponse } from "./agentResponse";
import type { AgentResponse } from "./agentResponse";
import { notifyUnauthorized } from "./reportApi";
import { currentGeneration } from "./session";

export { AgentApiError };
export type { AgentResponse };

const agentApiUrl = (): string | null =>
  resolveAgentApiUrl({
    configuredUrl: env.agentApiUrl,
    isDev: __DEV__,
    platform: Platform.OS,
  });

/**
 * Permite esconder la entrada al agente cuando el servicio no está
 * configurado, en vez de dejar que el usuario escriba una pregunta y recién
 * ahí descubra que no existe.
 */
export const isAgentAvailable = (): boolean => agentApiUrl() !== null;

const getAgentApiUrl = () => {
  const url = agentApiUrl();
  if (url) return url;
  throw new AgentApiError(
    0,
    "El servicio del agente no está configurado para esta versión.",
    "config",
  );
};

export const askAgent = async ({
  accessToken, message, conversationId, continuation = false, signal,
}: {
  accessToken: string; message: string; conversationId: string;
  continuation?: boolean; signal?: AbortSignal;
}): Promise<AgentResponse> => {
  const gen = currentGeneration();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45_000);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${getAgentApiUrl()}/api/agent/chat`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ message, conversationId, continuation }), signal: controller.signal,
    });
    // Un gateway puede devolver 401 con HTML o sin body. El estado HTTP sigue
    // invalidando la sesión incluso si no se puede interpretar JSON.
    if (response.status === 401) {
      notifyUnauthorized(gen);
      throw new AgentApiError(401, "La sesión venció o no es válida.", "session");
    }
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new AgentApiError(response.status, "El agente devolvió una respuesta inválida.", "transport"); }
    return interpretAgentResponse({ status: response.status, ok: response.ok, payload });
  } catch (error) {
    if (timedOut) throw new AgentApiError(504, "La consulta tardó demasiado. Podés reintentar.", "transport");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
};
