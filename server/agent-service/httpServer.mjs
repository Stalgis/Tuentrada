import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { AuthenticationError } from "./auth.mjs";
import { createConversationStore } from "./conversationStore.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 2_000;
const CONVERSATION_ID = /^[A-Za-z0-9_-]{8,64}$/;

class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestValidationError";
  }
}

const writeJson = (response, status, payload, { allowedOrigin = "*", headers = {} } = {}) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowedOrigin,
    Vary: "Origin",
    ...headers,
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

/**
 * `conversationId` lo genera el cliente. No identifica a nadie por sí solo: la
 * clave real del historial le antepone el fingerprint del token, así que
 * mandar el id de otro no da acceso a su conversación.
 */
const validateConversationId = (body) => {
  const value = body?.conversationId;
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !CONVERSATION_ID.test(value)) {
    throw new RequestValidationError(
      "conversationId debe tener entre 8 y 64 caracteres alfanuméricos, guion o guion bajo.",
    );
  }
  return value;
};

export const createAgentHttpServer = ({
  authenticate,
  answerQuestion,
  requestTimeoutMs = 25_000,
  allowedOrigin = "*",
  logger = console,
  guards = null,
  conversations = createConversationStore(),
  exposeToolCalls = false,
}) =>
  createServer(async (request, response) => {
    if (request.method === "OPTIONS" && request.url === "/api/agent/chat") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { ok: true, ...(guards ? guards.stats() : {}) }, { allowedOrigin });
      return;
    }

    if (request.method !== "POST" || request.url !== "/api/agent/chat") {
      writeJson(response, 404, { error: "Ruta no encontrada." }, { allowedOrigin });
      return;
    }

    // El presupuesto de tiempo arranca antes de autenticar y cubre toda la
    // petición. El timeout del backend de reportes es más corto a propósito,
    // para que la autenticación no se coma el presupuesto entero.
    const controller = new AbortController();
    let timedOut = false;
    let clientDisconnected = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("request timeout", "TimeoutError"));
    }, requestTimeoutMs);
    const abortDisconnected = () => {
      clientDisconnected = true;
      controller.abort(new DOMException("client disconnected", "AbortError"));
    };
    const onResponseClose = () => {
      if (!response.writableEnded) abortDisconnected();
    };
    request.once("aborted", abortDisconnected);
    response.once("close", onResponseClose);
    const requestId = randomUUID();
    const startedAt = Date.now();
    let releaseGuard = null;
    let fingerprint = null;
    let usage = null;
    let toolCalls = null;
    let limites = null;
    let turnos = null;
    let reports = null;
    let status = 200;

    try {
      // Este control no depende de una identidad ya validada: evita que tokens
      // aleatorios salteen presupuesto/concurrencia y lleguen al backend.
      releaseGuard = guards?.acquireGlobal
        ? guards.acquireGlobal()
        : null;

      const body = await readJson(request);
      const message = validateMessage(body);
      const conversationId = validateConversationId(body);

      const auth = await authenticate(request);
      fingerprint = auth.fingerprint;
      reports = auth.reports;
      reports?.setSignal?.(controller.signal);

      if (guards?.acquireSession) guards.acquireSession(fingerprint);
      else if (guards && !releaseGuard) releaseGuard = guards.acquire(fingerprint);

      const conversationKey = conversationId
        ? conversations.key(fingerprint, conversationId)
        : null;
      const history = conversationKey ? conversations.get(conversationKey) : [];

      const result = await answerQuestion({
        message,
        user: auth.user,
        reports: auth.reports,
        signal: controller.signal,
        history,
      });

      if (controller.signal.aborted) throw controller.signal.reason;

      if (conversationKey && Array.isArray(result.history)) {
        conversations.set(conversationKey, result.history);
      }

      usage = result.usage ?? null;
      toolCalls = result.toolCalls ?? null;
      limites = result.limites?.length ? result.limites : null;
      turnos = result.turnos ?? null;

      writeJson(
        response,
        200,
        {
          answer: result.answer,
          requestId,
          ...(exposeToolCalls ? { toolCalls: result.toolCalls } : {}),
        },
        { allowedOrigin },
      );
    } catch (error) {
      usage = error?.usage ?? usage;

      if (clientDisconnected) {
        // El socket ya no existe. 499 queda sólo en el log; no se intenta
        // escribir una respuesta ni persistir el historial del run abortado.
        status = 499;
      } else if (error instanceof AuthenticationError) {
        status = 401;
        writeJson(response, 401, { error: error.message, requestId }, { allowedOrigin });
      } else if (error instanceof RequestValidationError) {
        status = 400;
        writeJson(response, 400, { error: error.message, requestId }, { allowedOrigin });
      } else if (timedOut) {
        status = 504;
        writeJson(
          response,
          504,
          { error: "El agente tardó demasiado en responder.", requestId },
          { allowedOrigin },
        );
      } else if (Number.isInteger(error?.httpStatus)) {
        status = error.httpStatus;
        writeJson(
          response,
          error.httpStatus,
          {
            error: error.publicMessage ?? "Un servicio requerido no está disponible.",
            requestId,
          },
          {
            allowedOrigin,
            headers: error.retryAfterSeconds
              ? { "Retry-After": String(error.retryAfterSeconds) }
              : {},
          },
        );
      } else {
        status = 500;
        logger.error("Agent request failed", {
          requestId,
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        });
        writeJson(
          response,
          500,
          { error: "No se pudo procesar la consulta.", requestId },
          { allowedOrigin },
        );
      }
    } finally {
      clearTimeout(timeout);
      request.off("aborted", abortDisconnected);
      response.off("close", onResponseClose);
      releaseGuard?.();
      guards?.recordUsage(usage?.totalTokens ?? 0);

      // Una línea por petición. El requestId también viaja al cliente: cuando
      // alguien reporta "me contestó cualquier cosa", ese id encuentra el run.
      logger.log?.(
        JSON.stringify({
          evento: "agent_request",
          requestId,
          sesion: fingerprint,
          status,
          durationMs: Date.now() - startedAt,
          // Con estos dos se ajusta maxTurns con datos en vez de a ojo:
          // `turnos` dice si se quedó corto, `upstream` cuánto costó de verdad.
          turnos,
          upstream: reports?.upstreamCalls ?? null,
          // Guardas que se activaron. Contarlas es lo que dice si el tope de
          // disponibilidad molesta lo suficiente como para justificar la fase 2.
          limites,
          usage,
          // Los parámetros con que el modelo llamó cada tool son el dato más
          // útil del log: muestran cómo interpretó la pregunta y delatan una
          // descripción de schema mal escrita.
          toolCalls,
        }),
      );
    }
  });
