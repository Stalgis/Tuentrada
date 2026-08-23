import { createServer } from "node:http";
import { AuthenticationError, authenticateRequest } from "./auth.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 2_000;

class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
  }
}

const writeJson = (response, status, payload) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
};

const readJson = async (request) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new RequestValidationError("El body supera el límite permitido.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestValidationError("El body debe contener JSON válido.");
  }
};

const validateMessage = (body) => {
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) throw new RequestValidationError("message es obligatorio.");
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new RequestValidationError(
      `message no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`,
    );
  }
  return message;
};

export const createAgentHttpServer = ({
  expectedToken,
  reports,
  answerQuestion,
  requestTimeoutMs = 30_000,
  logger = console,
}) =>
  createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST" || request.url !== "/api/agent/chat") {
      writeJson(response, 404, { error: "Ruta no encontrada." });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const user = authenticateRequest(request, expectedToken);
      const body = await readJson(request);
      const message = validateMessage(body);
      const result = await answerQuestion({
        message,
        user,
        reports,
        signal: controller.signal,
      });
      writeJson(response, 200, result);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        writeJson(response, 401, { error: error.message });
      } else if (error instanceof RequestValidationError) {
        writeJson(response, 400, { error: error.message });
      } else if (controller.signal.aborted) {
        writeJson(response, 504, { error: "El agente tardó demasiado en responder." });
      } else {
        logger.error("Agent request failed", {
          name: error?.name,
          message: error?.message,
        });
        writeJson(response, 500, { error: "No se pudo procesar la consulta." });
      }
    } finally {
      clearTimeout(timeout);
    }
  });
