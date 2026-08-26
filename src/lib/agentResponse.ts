/**
 * Interpretación de la respuesta del servicio del agente.
 *
 * Vive separado de `agentApi` (que importa react-native) para poder testear
 * sin el runtime de Expo. El camino de 401 es el que más importa: es el que
 * decide si una sesión vencida cierra la sesión o se muestra como si fuera una
 * respuesta del agente.
 */

/**
 * `session` y `transport` son problemas de la plataforma, `agent` es una
 * respuesta real del servicio. La pantalla los muestra distinto: una burbuja
 * del asistente diciendo "tu sesión venció" se lee como si lo hubiera dicho el
 * agente.
 */
export type AgentErrorKind = "session" | "config" | "transport" | "agent";

export class AgentApiError extends Error {
  status: number;
  kind: AgentErrorKind;
  requestId?: string;

  constructor(
    status: number,
    message: string,
    kind: AgentErrorKind = "agent",
    requestId?: string,
  ) {
    super(message);
    this.name = "AgentApiError";
    this.status = status;
    this.kind = kind;
    this.requestId = requestId;
  }
}

export type AgentResponse = {
  answer: string;
  requestId?: string;
  toolCalls?: { toolName: string; parameters: unknown }[];
};

export const interpretAgentResponse = ({
  status,
  ok,
  payload,
}: {
  status: number;
  ok: boolean;
  payload: unknown;
}): AgentResponse => {
  const data = (payload ?? {}) as Partial<AgentResponse> & { error?: unknown };
  const requestId = typeof data.requestId === "string" ? data.requestId : undefined;
  const serverMessage = typeof data.error === "string" ? data.error : undefined;

  if (status === 401) {
    throw new AgentApiError(
      401,
      serverMessage ?? "La sesión venció o no es válida.",
      "session",
      requestId,
    );
  }

  if (!ok) {
    throw new AgentApiError(
      status,
      serverMessage ?? "No se pudo consultar al agente.",
      "agent",
      requestId,
    );
  }

  if (typeof data.answer !== "string" || !data.answer) {
    throw new AgentApiError(
      status,
      "El agente no devolvió una respuesta utilizable.",
      "transport",
      requestId,
    );
  }

  return { answer: data.answer, requestId, toolCalls: data.toolCalls };
};
