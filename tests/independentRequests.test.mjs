import assert from "node:assert/strict";
import test from "node:test";
import { runIndependentRequests } from "../src/lib/independentRequests.ts";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

test("this_month publica sin esperar que last_month termine", async () => {
  const current = deferred();
  const previous = deferred();
  const published = [];

  const loading = runIndependentRequests([
    {
      run: () => current.promise,
      onSuccess: (value) => published.push(`current:${value}`),
      onError: () => {},
      onSettled: () => published.push("current:settled"),
    },
    {
      run: () => previous.promise,
      onSuccess: (value) => published.push(`previous:${value}`),
      onError: () => published.push("previous:error"),
      onSettled: () => published.push("previous:settled"),
    },
  ]);

  current.resolve(100);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(published, ["current:100", "current:settled"]);

  previous.reject(new Error("504"));
  await loading;
  assert.deepEqual(published, [
    "current:100",
    "current:settled",
    "previous:error",
    "previous:settled",
  ]);
});
