import assert from "node:assert/strict";
import test from "node:test";
import { bumpGeneration, currentGeneration, isCurrentGeneration } from "../src/lib/session.ts";

test("una respuesta de una generación anterior queda invalidada", () => {
  const captured = currentGeneration();
  assert.equal(isCurrentGeneration(captured), true);
  bumpGeneration();
  assert.equal(isCurrentGeneration(captured), false);
  assert.equal(isCurrentGeneration(currentGeneration()), true);
});
