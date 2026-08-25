import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentApiUrl } from "../src/lib/agentApiUrl.ts";

test("iOS Simulator uses the local Node service by default", () => {
  assert.equal(
    resolveAgentApiUrl({ isDev: true, platform: "ios" }),
    "http://127.0.0.1:8787",
  );
});

test("Android emulator uses the host loopback alias by default", () => {
  assert.equal(
    resolveAgentApiUrl({ isDev: true, platform: "android" }),
    "http://10.0.2.2:8787",
  );
});

test("an explicitly configured agent URL always wins", () => {
  assert.equal(
    resolveAgentApiUrl({
      configuredUrl: "http://192.168.1.25:8787",
      isDev: true,
      platform: "ios",
    }),
    "http://192.168.1.25:8787",
  );
});

test("production requires an explicitly configured URL", () => {
  assert.equal(resolveAgentApiUrl({ isDev: false, platform: "ios" }), null);
});
