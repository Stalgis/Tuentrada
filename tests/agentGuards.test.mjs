import assert from "node:assert/strict";
import test from "node:test";
import {
  BudgetExhaustedError,
  OverloadedError,
  RateLimitError,
  createGuards,
} from "../server/agent-service/guards.mjs";

test("el limite por sesion corta despues de N consultas", () => {
  let clock = 0;
  const guards = createGuards({ maxPerWindow: 2, windowMs: 1_000, now: () => clock });

  guards.acquire("fp")();
  guards.acquire("fp")();
  assert.throws(() => guards.acquire("fp"), RateLimitError);

  // Otra sesion no arrastra el limite ajeno.
  guards.acquire("otra")();
});

test("la ventana se libera con el tiempo y sugiere cuando reintentar", () => {
  let clock = 0;
  const guards = createGuards({ maxPerWindow: 1, windowMs: 1_000, now: () => clock });

  guards.acquire("fp")();

  try {
    guards.acquire("fp");
    assert.fail("deberia haber cortado");
  } catch (error) {
    assert.ok(error instanceof RateLimitError);
    assert.equal(error.httpStatus, 429);
    assert.equal(error.retryAfterSeconds, 1);
  }

  clock = 1_001;
  guards.acquire("fp")();
});

test("la concurrencia se libera al terminar la peticion", () => {
  const guards = createGuards({ maxConcurrent: 1, maxPerWindow: 100 });

  const release = guards.acquire("a");
  assert.throws(() => guards.acquire("b"), OverloadedError);

  release();
  guards.acquire("b")();
});

test("el límite global no se puede saltear rotando identidades", () => {
  const guards = createGuards({
    maxPerWindow: 100,
    maxGlobalPerWindow: 1,
    windowMs: 60_000,
  });

  guards.acquireGlobal()();
  assert.throws(() => guards.acquireGlobal(), RateLimitError);
});

test("liberar dos veces no descuenta de mas", () => {
  const guards = createGuards({ maxConcurrent: 1, maxPerWindow: 100 });
  const release = guards.acquire("a");
  release();
  release();

  assert.equal(guards.stats().inFlight, 0);
});

test("el presupuesto diario de tokens apaga el servicio", () => {
  // Protege contra un bug propio (un loop de tools), no solo contra abuso.
  const guards = createGuards({ dailyTokenBudget: 100, maxPerWindow: 100 });

  guards.acquire("fp")();
  guards.recordUsage(150);

  assert.throws(() => guards.acquire("fp"), BudgetExhaustedError);
});

test("el presupuesto se reinicia al cambiar de dia UTC", () => {
  let clock = Date.parse("2026-08-25T23:00:00Z");
  const guards = createGuards({
    dailyTokenBudget: 100,
    maxPerWindow: 100,
    now: () => clock,
  });

  guards.acquire("fp")();
  guards.recordUsage(150);
  assert.throws(() => guards.acquire("fp"), BudgetExhaustedError);

  clock = Date.parse("2026-08-26T01:00:00Z");
  guards.acquire("fp")();
  assert.equal(guards.stats().tokensToday, 0);
});

test("un uso invalido no ensucia el contador", () => {
  const guards = createGuards({ dailyTokenBudget: 100, maxPerWindow: 100 });
  guards.recordUsage(undefined);
  guards.recordUsage(Number.NaN);
  guards.recordUsage(-5);

  assert.equal(guards.stats().tokensToday, 0);
});

test("sin presupuesto configurado no hay tope de tokens", () => {
  const guards = createGuards({ dailyTokenBudget: 0, maxPerWindow: 100 });
  guards.acquire("fp")();
  guards.recordUsage(10_000_000);
  guards.acquire("fp")();
});
