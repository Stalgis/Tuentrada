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
  accessToken,
  message,
  conversationId,
  signal,
}: {
  accessToken: string;
  message: string;
  conversationId: string;
  signal?: AbortSignal;
}): Promise<AgentResponse> => {
  // Generación capturada antes de salir: identifica a qué sesión pertenece
  // esta petición cuando la respuesta llegue.
  const gen = currentGeneration();

  const response = await fetch(`${getAgentApiUrl()}/api/agent/chat`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message, conversationId }),
    signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AgentApiError(
      response.status,
      "El agente devolvió una respuesta inválida.",
      "transport",
    );
  }

  try {
    return interpretAgentResponse({
      status: response.status,
      ok: response.ok,
      payload,
    });
  } catch (error) {
    // Un 401 del agente significa lo mismo que un 401 de reportes: la sesión
    // murió. Se dispara el mismo teardown, con la guarda de generación para
    // que una respuesta tardía de una sesión anterior no cierre la vigente.
    if (error instanceof AgentApiError && error.kind === "session") {
      notifyUnauthorized(gen);
    }
    throw error;
  }
};
