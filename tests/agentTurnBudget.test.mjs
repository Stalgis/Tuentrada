import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { MaxTurnsExceededError } from "@openai/agents";
import { AgentTurnLimitError, answerWithAgent } from "../server/agent-service/agent.mjs";
import { createDemoAuthenticator } from "../server/agent-service/auth.mjs";
import { createAgentHttpServer } from "../server/agent-service/httpServer.mjs";
import {
  ReportApiClient,
  UpstreamBudgetError,
} from "../server/agent-service/reportApiClient.mjs";

const jsonResponse = (payload) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const validStats = {
  tickets: 1,
  invitations: 0,
  total_tickets: 1,
  total: 100,
  unique_buyers: 1,
};

// ─── Presupuesto de consultas al backend ─────────────────────────────────────

test("el tope de consultas es por peticion, no por herramienta", async () => {
  // Cada tool tiene su propio limite, pero eso es por llamada: sin este tope,
  // un run de varios turnos podia encadenar doce consultas de disponibilidad
  // seis veces.
  let calls = 0;
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    maxUpstreamCalls: 3,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ success: true, data: { "online-sales": [] } });
    },
  });

  await client.fetchOnlineSales("1");
  await client.fetchOnlineSales("2");
  await client.fetchOnlineSales("3");

  await assert.rejects(() => client.fetchOnlineSales("4"), UpstreamBudgetError);
  assert.equal(calls, 3, "la cuarta no llega a salir");
  // El contador refleja consultas que salieron, no intentos: si contara los
  // bloqueados, el log diria un costo mas alto del real.
  assert.equal(client.upstreamCalls, 3);
});

test("el error de presupuesto sale con status y mensaje propios", async () => {
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    maxUpstreamCalls: 0,
    fetchImpl: async () => jsonResponse({ success: true, data: {} }),
  });

  await assert.rejects(
    () => client.listEvents(),
    (error) => {
      assert.ok(error instanceof UpstreamBudgetError);
      assert.equal(error.httpStatus, 503);
      assert.match(error.publicMessage, /más acotada/);
      return true;
    },
  );
});

test("las consultas repetidas no gastan presupuesto: el memo las absorbe", async () => {
  let calls = 0;
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    maxUpstreamCalls: 2,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ success: true, data: { stats: validStats } });
    },
  });

  for (let i = 0; i < 10; i += 1) {
    await client.fetchStats(["1"], { date: "all" });
  }

  assert.equal(calls, 1);
  assert.equal(client.upstreamCalls, 1);
});

test("upstreamCalls cuenta lo que de verdad salio", async () => {
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async () =>
      jsonResponse({ success: true, data: { stats: validStats, resources: [] } }),
  });

  assert.equal(client.upstreamCalls, 0);
  await client.listEvents();
  await client.fetchStats(["1"], { date: "all" });
  await client.fetchStats(["1"], { date: "this_month" });
  assert.equal(client.upstreamCalls, 3);
});

// ─── Turnos ──────────────────────────────────────────────────────────────────

const okResult = (turnos = 2) => ({
  finalOutput: "listo",
  history: [],
  rawResponses: Array.from({ length: turnos }, () => ({
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  })),
});

test("maxTurns por defecto es 6, no 4", async () => {
  // Con cinco herramientas una pregunta compuesta necesita tres o cuatro
  // turnos, y con cuatro se cortaba antes de responder.
  let recibido = null;
  await answerWithAgent({
    message: "hola",
    user: { id: "u" },
    reports: {},
    runner: async (_agent, _input, options) => {
      recibido = options.maxTurns;
      return okResult();
    },
  });

  assert.equal(recibido, 6);
});

test("maxTurns se puede ajustar por parametro", async () => {
  let recibido = null;
  await answerWithAgent({
    message: "hola",
    user: { id: "u" },
    reports: {},
    maxTurns: 3,
    runner: async (_agent, _input, options) => {
      recibido = options.maxTurns;
      return okResult();
    },
  });

  assert.equal(recibido, 3);
});

test("el resultado informa cuantos turnos se usaron", async () => {
  const result = await answerWithAgent({
    message: "hola",
    user: { id: "u" },
    reports: {},
    runner: async () => okResult(4),
  });

  assert.equal(result.turnos, 4);
});

test("quedarse sin turnos no se esconde entre los 500", async () => {
  // Es la senal de que maxTurns quedo corto: tiene que poder contarse aparte.
  await assert.rejects(
    () =>
      answerWithAgent({
        message: "hola",
        user: { id: "u" },
        reports: {},
        maxTurns: 2,
        runner: async () => {
          throw new MaxTurnsExceededError("Max turns exceeded");
        },
      }),
    (error) => {
      assert.ok(error instanceof AgentTurnLimitError);
      assert.equal(error.httpStatus, 502);
      assert.match(error.message, /2 turnos/);
      assert.match(error.publicMessage, /una cosa por vez/);
      return true;
    },
  );
});

test("un run fallido conserva el uso acumulado por el SDK", async () => {
  await assert.rejects(
    () =>
      answerWithAgent({
        message: "hola",
        user: { id: "u" },
        reports: {},
        maxTurns: 2,
        runner: async () => {
          throw new MaxTurnsExceededError("Max turns exceeded", {
            usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
          });
        },
      }),
    (error) => {
      assert.ok(error instanceof AgentTurnLimitError);
      assert.deepEqual(error.usage, {
        inputTokens: 80,
        outputTokens: 20,
        totalTokens: 100,
      });
      return true;
    },
  );
});

// ─── Log ─────────────────────────────────────────────────────────────────────

test("los limites que se activaron salen en su propio campo del log", async (t) => {
  // Contar cuantas veces se topea disponibilidad es lo que decide si vale la
  // pena construir el snapshot de la fase 2.
  const lineas = [];
  const server = createAgentHttpServer({
    authenticate: createDemoAuthenticator({ expectedToken: "t", reports: {} }),
    answerQuestion: async () => ({
      answer: "ok",
      limites: [
        { tipo: "funciones_disponibilidad", evento: "Charlie", funciones: 98, tope: 12 },
      ],
    }),
    logger: { error: () => {}, log: (linea) => lineas.push(JSON.parse(linea)) },
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  await fetch(`http://127.0.0.1:${server.address().port}/api/agent/chat`, {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hola" }),
  });

  assert.deepEqual(lineas[0].limites, [
    { tipo: "funciones_disponibilidad", evento: "Charlie", funciones: 98, tope: 12 },
  ]);
});

test("sin limites activados el campo queda en null, no en lista vacia", async (t) => {
  // Asi `grep '"limites":null'` separa de una las peticiones limpias.
  const lineas = [];
  const server = createAgentHttpServer({
    authenticate: createDemoAuthenticator({ expectedToken: "t", reports: {} }),
    answerQuestion: async () => ({ answer: "ok", limites: [] }),
    logger: { error: () => {}, log: (linea) => lineas.push(JSON.parse(linea)) },
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  await fetch(`http://127.0.0.1:${server.address().port}/api/agent/chat`, {
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hola" }),
  });

  assert.equal(lineas[0].limites, null);
});

test("la linea de log trae turnos y consultas upstream", async (t) => {
  // Sin estos dos campos, ajustar maxTurns seria a ojo.
  const lineas = [];
  const reports = { upstreamCalls: 7 };
  const server = createAgentHttpServer({
    authenticate: createDemoAuthenticator({ expectedToken: "test-token", reports }),
    answerQuestion: async () => ({
      answer: "ok",
      toolCalls: [],
      usage: { totalTokens: 15 },
      turnos: 3,
    }),
    logger: { error: () => {}, log: (linea) => lineas.push(JSON.parse(linea)) },
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  await fetch(`http://127.0.0.1:${server.address().port}/api/agent/chat`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hola" }),
  });

  assert.equal(lineas[0].turnos, 3);
  assert.equal(lineas[0].upstream, 7);
  assert.equal(lineas[0].status, 200);
});

test("un fallo antes de autenticar deja turnos y upstream en null, no en cero", async (t) => {
  // Cero significaria "no consulto nada"; null significa "nunca llego a esa
  // etapa". Confundirlos ensucia cualquier promedio.
  const lineas = [];
  const server = createAgentHttpServer({
    authenticate: createDemoAuthenticator({ expectedToken: "test-token", reports: {} }),
    answerQuestion: async () => ({ answer: "ok" }),
    logger: { error: () => {}, log: (linea) => lineas.push(JSON.parse(linea)) },
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  await fetch(`http://127.0.0.1:${server.address().port}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hola" }),
  });

  assert.equal(lineas[0].status, 401);
  assert.equal(lineas[0].turnos, null);
  assert.equal(lineas[0].upstream, null);
});
