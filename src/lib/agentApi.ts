import { Platform } from "react-native";
import { env } from "./env";
import { resolveAgentApiUrl } from "./agentApiUrl";

export class AgentApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AgentApiError";
    this.status = status;
  }
}

type AgentResponse = {
  answer: string;
  toolCalls?: { toolName: string; parameters: unknown }[];
};

const getAgentApiUrl = () => {
  const url = resolveAgentApiUrl({
    configuredUrl: env.agentApiUrl,
    isDev: __DEV__,
    platform: Platform.OS,
  });

  if (url) return url;
  throw new AgentApiError(0, "El servicio del agente no está configurado para esta versión.");
};

export const askAgent = async ({
  accessToken,
  message,
  signal,
}: {
  accessToken: string;
  message: string;
  signal?: AbortSignal;
}): Promise<AgentResponse> => {
  const response = await fetch(`${getAgentApiUrl()}/api/agent/chat`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
    signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AgentApiError(response.status, "El agente devolvió una respuesta inválida.");
  }

  const data = payload as Partial<AgentResponse> & { error?: unknown };
  if (!response.ok) {
    throw new AgentApiError(
      response.status,
      typeof data.error === "string" ? data.error : "No se pudo consultar al agente.",
    );
  }

  if (typeof data.answer !== "string") {
    throw new AgentApiError(response.status, "El agente no devolvió una respuesta utilizable.");
  }

  return { answer: data.answer, toolCalls: data.toolCalls };
};
