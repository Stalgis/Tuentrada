import assert from "node:assert/strict";
import test from "node:test";
import { InflightRegistry } from "../src/lib/InflightRegistry.ts";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test("cuatro consumidores simultáneos comparten una sola carga", async () => {
  const registry = new InflightRegistry();
  const pending = deferred();
  let calls = 0;
  const load = () => registry.getOrCreate("events", () => {
    calls += 1;
    return pending.promise;
  });

  const requests = [load(), load(), load(), load()];
  assert.equal(calls, 1);
  pending.resolve("ok");
  assert.deepEqual(await Promise.all(requests), ["ok", "ok", "ok", "ok"]);
  assert.equal(registry.has("events"), false);
});

test("un error se comparte y luego permite reintentar", async () => {
  const registry = new InflightRegistry();
  let calls = 0;
  const first = registry.getOrCreate("events", async () => {
    calls += 1;
    throw new Error("falló");
  });
  const second = registry.getOrCreate("events", async () => "unexpected");

  await assert.rejects(first, /falló/);
  await assert.rejects(second, /falló/);
  assert.equal(registry.has("events"), false);
  assert.equal(await registry.getOrCreate("events", async () => {
    calls += 1;
    return "retry-ok";
  }), "retry-ok");
  assert.equal(calls, 2);
});

test("una promesa vieja no elimina la entrada creada después de clear", async () => {
  const registry = new InflightRegistry();
  const oldRequest = deferred();
  const newRequest = deferred();

  const oldPromise = registry.getOrCreate("events", () => oldRequest.promise);
  registry.clear();
  const newPromise = registry.getOrCreate("events", () => newRequest.promise);

  oldRequest.resolve("old");
  assert.equal(await oldPromise, "old");
  assert.equal(registry.has("events"), true);

  newRequest.resolve("new");
  assert.equal(await newPromise, "new");
  assert.equal(registry.has("events"), false);
});
