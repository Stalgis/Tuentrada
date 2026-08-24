import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createDemoAuthenticator } from "../server/agent-service/auth.mjs";
import { createAgentHttpServer } from "../server/agent-service/httpServer.mjs";

const startTestServer = async () => {
  const calls = [];
  const reports = { source: "fake" };
  const server = createAgentHttpServer({
    authenticate: createDemoAuthenticator({
      expectedToken: "test-token",
      reports,
    }),
    answerQuestion: async (input) => {
      calls.push(input);
      return { answer: `Respuesta a: ${input.message}`, toolCalls: [] };
    },
    logger: { error: () => {} },
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    calls,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

test("health no requiere autenticación", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await fetch(`${app.baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("chat rechaza una petición sin Bearer token", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await fetch(`${app.baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hola" }),
  });

  assert.equal(response.status, 401);
  assert.equal(app.calls.length, 0);
});

test("chat valida que message exista", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await fetch(`${app.baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 400);
  assert.equal(app.calls.length, 0);
});

test("chat deriva el usuario de autenticación y llama al agente", async (t) => {
  const app = await startTestServer();
  t.after(() => app.server.close());

  const response = await fetch(`${app.baseUrl}/api/agent/chat`, {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Compará Festival Horizonte con Noche Neón",
      userId: "another-user",
    }),
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
