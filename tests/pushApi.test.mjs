import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadTsModule } from "./helpers/loadTsModule.mjs";
import * as schemas from "../shared/notifications.ts";

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const setup = () => {
  const storage = new Map();
  let generation = 1;
  let fetch = async () => ({ ok: true, status: 204 });
  const unauthorized = [];
  const api = loadTsModule(fileURLToPath(new URL("../src/lib/pushApi.ts", import.meta.url)), {
    "react-native": { Platform: { OS: "android" } },
    "expo-constants": { expoConfig: { version: "1" } },
    "expo-secure-store": {
      getItemAsync: async key => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { storage.set(key, value); },
      deleteItemAsync: async key => { storage.delete(key); },
    },
    "./env": { env: { notificationsApiUrl: "https://notifications.example" } },
    "./backendFetch": { backendFetch: (...args) => fetch(...args) },
    "./reportApi": { ApiTimeoutError: Error, ApiUnauthorizedError: Error, notifyUnauthorized: gen => { if (gen === generation) unauthorized.push(gen); } },
    "./session": { currentGeneration: () => generation, isCurrentGeneration: gen => gen === generation },
    "../../shared/notifications": schemas,
  });
  return { api, unauthorized, next: () => { generation++; }, setFetch: value => { fetch = value; } };
};

test("logout cleanup cannot erase a token registered by the next session", async () => {
  const { api, next } = setup();
  await api.registerDevice("A", api.buildRegistration("ExpoPushToken[A]"));
  const oldToken = api.takeStoredPushToken();
  next();
  await api.registerDevice("B", api.buildRegistration("ExpoPushToken[B]"));
  assert.equal(await oldToken, "ExpoPushToken[A]");
  assert.equal(await api.readStoredPushToken(), "ExpoPushToken[B]");
});

test("a late registration response after logout never restores the token", async () => {
  const { api, next, setFetch } = setup();
  const response = deferred();
  setFetch(() => response.promise);
  const registration = api.registerDevice("A", api.buildRegistration("ExpoPushToken[A]"));
  const cleanup = api.takeStoredPushToken();
  next();
  response.resolve({ ok: true, status: 204 });
  await Promise.all([registration, cleanup]);
  assert.equal(await api.readStoredPushToken(), null);
});

test("an old logout 401 never invalidates the new session", async () => {
  const { api, next, setFetch, unauthorized } = setup();
  next();
  setFetch(async () => ({ ok: false, status: 401 }));
  await api.unregisterDevice("A", "ExpoPushToken[A]");
  assert.deepEqual(unauthorized, []);
});

test("non-JSON unauthorized responses still expire the active session", async () => {
  const { api, setFetch, unauthorized } = setup();
  setFetch(async () => ({ ok: false, status: 401, json: async () => { throw new Error("HTML"); } }));
  await assert.rejects(api.loadPreferences("A"));
  assert.deepEqual(unauthorized, [1]);
});
