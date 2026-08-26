import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentApiError,
  interpretAgentResponse,
} from "../src/lib/agentResponse.ts";

const interpret = (status, payload) =>
  interpretAgentResponse({ status, ok: status >= 200 && status < 300, payload });

test("una respuesta válida devuelve answer y requestId", () => {
  const result = interpret(200, { answer: "Tenés 3 eventos.", requestId: "abc" });
  assert.equal(result.answer, "Tenés 3 eventos.");
  assert.equal(result.requestId, "abc");
});

test("un 401 se marca como problema de sesion, no como respuesta del agente", () => {
  // De este `kind` depende que la app cierre la sesion en vez de pintar el
  // error como si lo hubiera dicho el agente.
  try {
    interpret(401, { error: "La sesión venció o no es válida.", requestId: "r1" });
    assert.fail("deberia haber lanzado");
  } catch (error) {
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.kind, "session");
    assert.equal(error.status, 401);
    assert.equal(error.requestId, "r1");
    assert.match(error.message, /venció/);
  }
});

test("un 401 sin cuerpo util igual se clasifica como sesion", () => {
  assert.throws(
    () => interpret(401, {}),
    (error) => error.kind === "session" && /venció|válida/.test(error.message),
  );
});

test("los errores del servicio conservan el mensaje publico del servidor", () => {
  for (const status of [429, 500, 502, 503, 504]) {
    try {
      interpret(status, { error: "mensaje del servidor" });
      assert.fail("deberia haber lanzado");
    } catch (error) {
      assert.equal(error.kind, "agent");
      assert.equal(error.status, status);
      assert.equal(error.message, "mensaje del servidor");
    }
  }
});

test("un 200 sin answer utilizable es un problema de transporte", () => {
  for (const payload of [{}, { answer: null }, { answer: "" }, { answer: 3 }]) {
    assert.throws(
      () => interpret(200, payload),
      (error) => error.kind === "transport",
    );
  }
});

test("un payload nulo no rompe la interpretacion", () => {
  assert.throws(() => interpret(200, null), AgentApiError);
});
