import assert from "node:assert/strict";
import test from "node:test";
import {
  CONVERSATION_ID_PATTERN,
  newConversationId,
} from "../src/lib/agentConversation.ts";

test("el id generado pasa la validación del servidor", () => {
  // httpServer.mjs rechaza con 400 cualquier conversationId que no matchee
  // este patrón, así que un desajuste rompe cada mensaje del chat.
  for (let i = 0; i < 500; i += 1) {
    const id = newConversationId();
    assert.match(id, CONVERSATION_ID_PATTERN, `id inválido: "${id}"`);
  }
});

test("el patrón es el mismo que aplica el servidor", async () => {
  const { readFile } = await import("node:fs/promises");
  const httpServer = await readFile(
    new URL("../server/agent-service/httpServer.mjs", import.meta.url),
    "utf8",
  );

  assert.ok(
    httpServer.includes(CONVERSATION_ID_PATTERN.source),
    "cliente y servidor dejaron de compartir el formato de conversationId",
  );
});

test("dos ids seguidos no colisionan", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newConversationId()));
  assert.ok(ids.size > 990, `demasiadas colisiones: ${1000 - ids.size}`);
});

test("aguanta un Math.random degenerado sin quedar corto", () => {
  // Math.random() === 0 da "0", y slice(2,10) queda vacío: sin relleno el id
  // terminaba en guión y podía caer por debajo del mínimo de 8 caracteres.
  const original = Math.random;
  try {
    Math.random = () => 0;
    assert.match(newConversationId(), CONVERSATION_ID_PATTERN);
    Math.random = () => 0.5;
    assert.match(newConversationId(), CONVERSATION_ID_PATTERN);
  } finally {
    Math.random = original;
  }
});
