import assert from "node:assert/strict";
import test from "node:test";
import { AgentOutputError, answerWithAgent } from "../server/agent-service/agent.mjs";

const fakeRun = (result) => async () => result;

const okResult = {
  finalOutput: "Tenés 3 eventos.",
  history: [{ type: "message", role: "user", content: "hola" }],
  rawResponses: [
    { usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
    { usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } },
  ],
};

test("devuelve la respuesta, el historial y el uso acumulado", async () => {
  const result = await answerWithAgent({
    message: "hola",
    user: { id: "u" },
    reports: {},
    runner: fakeRun(okResult),
  });

  assert.equal(result.answer, "Tenés 3 eventos.");
  assert.deepEqual(result.usage, { inputTokens: 150, outputTokens: 30, totalTokens: 180 });
  assert.equal(result.history.length, 1);
});

test("el historial previo va delante del mensaje nuevo", async () => {
  let recibido = null;
  await answerWithAgent({
    message: "¿y la semana que viene?",
    user: { id: "u" },
    reports: {},
    history: [{ type: "message", role: "user", content: "¿cuántos eventos tengo?" }],
    runner: async (_agent, input) => {
      recibido = input;
      return okResult;
    },
  });

  assert.equal(recibido.length, 2);
  assert.equal(recibido[0].content, "¿cuántos eventos tengo?");
  assert.deepEqual(recibido[1], {
    type: "message",
    role: "user",
    content: "¿y la semana que viene?",
  });
});

test("sin historial se manda solo el turno actual", async () => {
  let recibido = null;
  await answerWithAgent({
    message: "hola",
    user: { id: "u" },
    reports: {},
    runner: async (_agent, input) => {
      recibido = input;
      return okResult;
    },
  });

  assert.equal(recibido.length, 1);
});

test("un finalOutput ausente es un 502, no un 200 con la respuesta vacia", async () => {
  // Antes esto salia con 200 y sin `answer`: un fallo del servidor disfrazado
  // de exito, invisible en las metricas de error.
  for (const finalOutput of [undefined, null, "", "   ", 42]) {
    await assert.rejects(
      () =>
        answerWithAgent({
          message: "hola",
          user: { id: "u" },
          reports: {},
          runner: fakeRun({ ...okResult, finalOutput }),
        }),
      (error) => {
        assert.ok(error instanceof AgentOutputError);
        assert.equal(error.httpStatus, 502);
        assert.match(error.publicMessage, /no pudo generar una respuesta/);
        return true;
      },
    );
  }
});

test("un run sin datos de uso no rompe el contador", async () => {
  const result = await answerWithAgent({
    message: "hola",
    user: { id: "u" },
    reports: {},
    runner: fakeRun({ finalOutput: "ok", history: [], rawResponses: [{}] }),
  });

  assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
});

test("el token nunca entra al contexto del run", async () => {
  let contexto = null;
  await answerWithAgent({
    message: "hola",
    user: { id: "session-abc123" },
    reports: { source: "fake" },
    runner: async (_agent, _input, options) => {
      contexto = options.context;
      return okResult;
    },
  });

  assert.equal(JSON.stringify(Object.keys(contexto)).includes("token"), false);
  assert.equal(contexto.user.id, "session-abc123");
  assert.ok(contexto.now instanceof Date);
});
