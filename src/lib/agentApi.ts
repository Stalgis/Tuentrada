import Constants from "expo-constants";
import { Platform } from "react-native";
import { env } from "./env";

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

const resolveAgentApiUrl = () => {
  if (env.agentApiUrl) return env.agentApiUrl;

  if (__DEV__) {
    const expoHost = Constants.expoConfig?.hostUri?.split(":")[0];
    if (expoHost) return `http://${expoHost}:8787`;
    if (Platform.OS === "android") return "http://10.0.2.2:8787";
    return "http://127.0.0.1:8787";
  }

  throw new AgentApiError(
    0,
    "El servicio del agente no está configurado para esta versión.",
  );
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
  const response = await fetch(`${resolveAgentApiUrl()}/api/agent/chat`, {
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
