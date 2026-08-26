import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import {
  createDemoAuthenticator,
  createUpstreamAuthenticator,
} from "../server/agent-service/auth.mjs";
import { createAgentHttpServer } from "../server/agent-service/httpServer.mjs";
import { createConversationStore } from "../server/agent-service/conversationStore.mjs";
import { createGuards } from "../server/agent-service/guards.mjs";
import { ReportApiClient } from "../server/agent-service/reportApiClient.mjs";

const silentLogger = { error: () => {}, log: () => {} };

const startTestServer = async ({
  answerQuestion,
  authenticate,
  guards,
  conversations,
  exposeToolCalls,
} = {}) => {
  const calls = [];
  const reports = { source: "fake" };
  const server = createAgentHttpServer({
    authenticate:
      authenticate ??
      createDemoAuthenticator({ expectedToken: "test-token", reports }),
    answerQuestion:
      answerQuestion ??
      (async (input) => {
        calls.push(input);
        return {
          answer: `Respuesta a: ${input.message}`,
          toolCalls: [{ toolName: "buscar_eventos", parameters: {} }],
          history: [
            ...input.history,
            { type: "message", role: "user", content: input.message },
            { type: "message", role: "assistant", content: "ok" },
          ],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      }),
    guards,
    conversations,
    exposeToolCalls,
    logger: silentLogger,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return { calls, server, baseUrl: `http://127.0.0.1:${address.port}` };
};

const chat = (baseUrl, body, token = "test-token") =>
  fetch(`${baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

test("health no requiere autenticación", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await fetch(`${app.baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test("chat rechaza una petición sin Bearer token", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, { message: "Hola" }, null);
  assert.equal(response.status, 401);
  assert.equal(app.calls.length, 0);
});

test("chat valida que message exista", async (t) => {
  let authCalls = 0;
  const app = await startTestServer({
    authenticate: async () => {
      authCalls += 1;
      return { user: { id: "u" }, fingerprint: "fp", reports: {} };
    },
  });
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, {});
  assert.equal(response.status, 400);
  assert.equal(app.calls.length, 0);
  assert.equal(authCalls, 0, "un body inválido no debe tocar autenticación ni reportes");
});

test("chat deriva el usuario de autenticación y llama al agente", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, {
    message: "Compará Festival Horizonte con Noche Neón",
    userId: "another-user",
  });

  assert.equal(response.status, 200);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].user.id, "demo-user");
  assert.equal(app.calls[0].reports.source, "fake");
  assert.equal("userId" in app.calls[0], false);
});

test("chat responde el preflight CORS sin autenticar", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await fetch(`${app.baseUrl}/api/agent/chat`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:8081" },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});

test("un 401 del backend evita gastar una llamada a OpenAI", async (t) => {
  // Es la promesa central del README y no estaba cubierta.
  let agentCalls = 0;
  const app = await startTestServer({
    authenticate: createUpstreamAuthenticator({
      createReports: (accessToken, fingerprint) =>
        new ReportApiClient({
          baseUrl: "https://reports.example.test",
          apiKey: "k",
          accessToken,
          cacheKey: fingerprint,
          fetchImpl: async () => new Response("{}", { status: 401 }),
        }),
    }),
    answerQuestion: async () => {
      agentCalls += 1;
      return { answer: "no deberia llegar acá" };
    },
  });
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, { message: "Hola" }, "token-vencido");

  assert.equal(response.status, 401);
  assert.equal(agentCalls, 0);
  assert.match((await response.json()).error, /sesión venció|no es válida/);
});

test("el timeout del backend sale 504, no 500", async (t) => {
  const app = await startTestServer({
    authenticate: createUpstreamAuthenticator({
      createReports: (accessToken) =>
        new ReportApiClient({
          baseUrl: "https://reports.example.test",
          apiKey: "k",
          accessToken,
          timeoutMs: 10,
          fetchImpl: (url, init) =>
            new Promise((_resolve, reject) => {
              init.signal.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError")),
              );
            }),
        }),
    }),
  });
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, { message: "Hola" });
  assert.equal(response.status, 504);
});

test("un error del agente con httpStatus sale con ese status y mensaje publico", async (t) => {
  const app = await startTestServer({
    answerQuestion: async () => {
      const error = new Error("finalOutput vacío");
      error.httpStatus = 502;
      error.publicMessage = "El agente no pudo generar una respuesta. Probá de nuevo.";
      throw error;
    },
  });
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, { message: "Hola" });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /no pudo generar una respuesta/);
});

test("toda respuesta trae requestId para poder rastrear el run", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const ok = await (await chat(app.baseUrl, { message: "Hola" })).json();
  assert.match(ok.requestId, /^[0-9a-f-]{36}$/);

  const bad = await (await chat(app.baseUrl, {})).json();
  assert.match(bad.requestId, /^[0-9a-f-]{36}$/);
});

test("toolCalls no viaja al cliente salvo que se active a proposito", async (t) => {
  const oculto = await startTestServer();
  t.after(() => oculto.server.close());
  const sinToolCalls = await (await chat(oculto.baseUrl, { message: "Hola" })).json();
  assert.equal("toolCalls" in sinToolCalls, false);

  const visible = await startTestServer({ exposeToolCalls: true });
  t.after(() => visible.server.close());
  const conToolCalls = await (await chat(visible.baseUrl, { message: "Hola" })).json();
  assert.equal(conToolCalls.toolCalls.length, 1);
});

test("el historial se acumula entre mensajes de la misma conversacion", async (t) => {
  const conversations = createConversationStore();
  const app = await startTestServer({ conversations });
  t.after(() => app.server.close());

  await chat(app.baseUrl, { message: "¿Cuántos eventos tengo?", conversationId: "conv-1234" });
  await chat(app.baseUrl, { message: "¿y la semana que viene?", conversationId: "conv-1234" });

  assert.deepEqual(app.calls[0].history, []);
  assert.equal(app.calls[1].history.length, 2);
  assert.equal(app.calls[1].history[0].content, "¿Cuántos eventos tengo?");
});

test("sin conversationId cada mensaje sigue siendo independiente", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  await chat(app.baseUrl, { message: "uno" });
  await chat(app.baseUrl, { message: "dos" });

  assert.deepEqual(app.calls[1].history, []);
});

test("un conversationId mal formado se rechaza antes de llamar al agente", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await chat(app.baseUrl, { message: "Hola", conversationId: "corto" });
  assert.equal(response.status, 400);
  assert.equal(app.calls.length, 0);
});

test("el limite por sesion devuelve 429 con Retry-After", async (t) => {
  const guards = createGuards({ maxPerWindow: 1, windowMs: 60_000 });
  const app = await startTestServer({ guards });
  t.after(() => app.server.close());

  assert.equal((await chat(app.baseUrl, { message: "uno" })).status, 200);

  const limitado = await chat(app.baseUrl, { message: "dos" });
  assert.equal(limitado.status, 429);
  assert.ok(Number(limitado.headers.get("retry-after")) > 0);
  assert.equal(app.calls.length, 1);
});

test("el presupuesto de tokens corta antes de autenticar la siguiente consulta", async (t) => {
  const guards = createGuards({ dailyTokenBudget: 10, maxPerWindow: 100 });
  let authCalls = 0;
  const app = await startTestServer({
    guards,
    authenticate: async () => {
      authCalls += 1;
      return { user: { id: "u" }, fingerprint: "fp", reports: {} };
    },
  });
  t.after(() => app.server.close());

  // La primera consume 15 tokens segun el fake, por encima del tope de 10.
  assert.equal((await chat(app.baseUrl, { message: "uno" })).status, 200);

  const cortado = await chat(app.baseUrl, { message: "dos" });
  assert.equal(cortado.status, 503);
  assert.equal(app.calls.length, 1);
  assert.equal(authCalls, 1);
});

test("la concurrencia global corta antes de autenticar", async (t) => {
  const guards = createGuards({ maxConcurrent: 1, maxPerWindow: 100 });
  const release = guards.acquireGlobal();
  let authCalls = 0;
  const app = await startTestServer({
    guards,
    authenticate: async () => {
      authCalls += 1;
      return { user: { id: "u" }, fingerprint: "fp", reports: {} };
    },
  });
  t.after(() => {
    release();
    app.server.close();
  });

  const response = await chat(app.baseUrl, { message: "hola" });

  assert.equal(response.status, 503);
  assert.equal(authCalls, 0);
});

test("los tokens de un run fallido también consumen el presupuesto", async (t) => {
  const guards = createGuards({ dailyTokenBudget: 50, maxPerWindow: 100 });
  let agentCalls = 0;
  const app = await startTestServer({
    guards,
    answerQuestion: async () => {
      agentCalls += 1;
      const error = new Error("falló después de usar el modelo");
      error.httpStatus = 502;
      error.publicMessage = "No se pudo completar.";
      error.usage = { inputTokens: 50, outputTokens: 10, totalTokens: 60 };
      throw error;
    },
  });
  t.after(() => app.server.close());

  assert.equal((await chat(app.baseUrl, { message: "uno" })).status, 502);
  assert.equal(guards.stats().tokensToday, 60);
  assert.equal((await chat(app.baseUrl, { message: "dos" })).status, 503);
  assert.equal(agentCalls, 1);
});

test("si el cliente cancela se aborta el run y no se guarda historial", async (t) => {
  const conversations = createConversationStore();
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  let serverSawAbort = false;
  let markAborted;
  const aborted = new Promise((resolve) => {
    markAborted = resolve;
  });
  const app = await startTestServer({
    conversations,
    answerQuestion: async ({ signal }) => {
      markStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            serverSawAbort = true;
            markAborted();
            reject(signal.reason);
          },
          { once: true },
        );
      });
    },
  });
  t.after(() => app.server.close());

  const controller = new AbortController();
  const cancelled = fetch(`${app.baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ message: "cancelar", conversationId: "conv-cancel" }),
    signal: controller.signal,
  });
  await started;
  controller.abort();
  await assert.rejects(cancelled, (error) => error.name === "AbortError");
  let abortTimer;
  try {
    await Promise.race([
      aborted,
      new Promise((_resolve, reject) => {
        abortTimer = setTimeout(
          () => reject(new Error("el servidor no observó la cancelación")),
          1_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(abortTimer);
  }

  assert.equal(serverSawAbort, true);
  assert.equal(conversations.size, 0);
});
