import assert from "node:assert/strict";
import test from "node:test";
import {
  createConversationStore,
  trimHistory,
} from "../server/agent-service/conversationStore.mjs";

const userMessage = (text) => ({ type: "message", role: "user", content: text });
const assistantMessage = (text) => ({ type: "message", role: "assistant", content: text });

test("guarda y devuelve el historial de una conversacion", () => {
  const store = createConversationStore();
  const key = store.key("fp-a", "conv-1");

  assert.deepEqual(store.get(key), []);
  store.set(key, [userMessage("hola"), assistantMessage("buenas")]);
  assert.equal(store.get(key).length, 2);
});

test("el mismo conversationId con otro token no comparte historial", () => {
  // Sin el fingerprint en la clave, mandar el id de otro alcanzaria para leer
  // su conversacion.
  const store = createConversationStore();
  store.set(store.key("fp-a", "conv-1"), [userMessage("mis eventos")]);

  assert.deepEqual(store.get(store.key("fp-b", "conv-1")), []);
});

test("una conversacion vencida se descarta", () => {
  let clock = 0;
  const store = createConversationStore({ ttlMs: 1_000, now: () => clock });
  const key = store.key("fp", "conv");

  store.set(key, [userMessage("hola")]);
  clock = 999;
  assert.equal(store.get(key).length, 1);

  clock = 1_001;
  assert.deepEqual(store.get(key), []);
});

test("el tope de conversaciones desaloja la mas vieja", () => {
  let clock = 0;
  const store = createConversationStore({ maxConversations: 2, now: () => clock });

  store.set(store.key("fp", "a"), [userMessage("1")]);
  clock += 1;
  store.set(store.key("fp", "b"), [userMessage("2")]);
  clock += 1;
  store.set(store.key("fp", "c"), [userMessage("3")]);

  assert.equal(store.size, 2);
  assert.deepEqual(store.get(store.key("fp", "a")), []);
  assert.equal(store.get(store.key("fp", "c")).length, 1);
});

test("el recorte corta en un mensaje del usuario, no en medio de una tool", () => {
  // Cortar entre un function_call y su function_call_result deja una secuencia
  // que la API rechaza.
  const history = [
    userMessage("uno"),
    assistantMessage("respuesta uno"),
    userMessage("dos"),
    { type: "function_call", name: "buscar_eventos", callId: "c1" },
    { type: "function_call_result", callId: "c1", output: "{}" },
    assistantMessage("respuesta dos"),
  ];

  const trimmed = trimHistory(history, 4);

  assert.equal(trimmed[0].role, "user");
  assert.equal(trimmed[0].content, "dos");
  assert.equal(trimmed.length, 4);
});

test("si no hay mensaje de usuario en la ventana se conserva todo", () => {
  // Mejor pagar tokens de mas que mandar una secuencia que no se puede procesar.
  const history = [
    userMessage("uno"),
    { type: "function_call", name: "buscar_eventos", callId: "c1" },
    { type: "function_call_result", callId: "c1", output: "{}" },
    assistantMessage("fin"),
  ];

  assert.deepEqual(trimHistory(history, 2), history);
});

test("un historial corto no se toca", () => {
  const history = [userMessage("hola")];
  assert.deepEqual(trimHistory(history, 40), history);
  assert.deepEqual(trimHistory(undefined, 40), []);
});
