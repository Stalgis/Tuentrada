import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { loadTsModule } from "./helpers/loadTsModule.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const defaults = { functionReports: false, weeklySummary: false };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const setup = async (t, { getToken = async () => "expo-token", load = async () => ({ ...defaults }) } = {}) => {
  let gen = 1;
  let auth = { accessToken: "account-a", sessionGeneration: gen };
  let current;
  let tokenCalls = 0;
  const registrations = [], saves = [], loads = [];
  const module = loadTsModule("src/store/push.tsx", {
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "./auth": { useAuth: () => auth },
    "../lib/session": { currentGeneration: () => gen, isCurrentGeneration: captured => gen === captured },
    "../lib/pushApi": { DEFAULT_PREFERENCES: defaults, PUSH_BACKEND_READY: true, PUSH_FEATURE_ENABLED: true,
      buildRegistration: expoPushToken => ({ expoPushToken }), hasAnyCategoryEnabled: p => p.functionReports || p.weeklySummary,
      loadPreferences: async token => { loads.push(token); return load(token); },
      registerDevice: async (...args) => { registrations.push(args); },
      savePreferences: async (...args) => { saves.push(args); },
    },
    "../lib/pushNotifications": { configureForegroundHandler() {}, ensureAndroidChannels: async () => {}, getExpoPushToken: () => { tokenCalls++; return tokenCalls === 2 ? getToken() : Promise.resolve("token-" + auth.accessToken); },
      getPermissionState: async () => "granted", isPushSupported: () => true, openSystemSettings: async () => {},
      pushUnsupportedReason: () => undefined, requestPermission: async () => "granted",
    },
  });
  const Probe = () => { current = module.usePush(); return null; };
  const tree = () => React.createElement(module.PushProvider, null, React.createElement(Probe));
  let renderer;
  await act(async () => { renderer = create(tree()); await flush(); });
  t.after(async () => { await act(() => renderer.unmount()); });
  registrations.length = 0;
  return { get value() { return current; }, registrations, saves, loads,
    switchAccount: async token => { gen++; auth = { accessToken: token, sessionGeneration: gen }; await act(async () => { renderer.update(tree()); await flush(); }); },
  };
};

test("logout durante obtención de token no deja switches bloqueados ni guarda datos viejos", async t => {
  const token = deferred();
  const app = await setup(t, { getToken: () => token.promise });
  let action;
  await act(async () => { action = app.value.setCategory("weeklySummary", true); await flush(); });
  assert.equal(app.value.busyCategory, "weeklySummary");
  await app.switchAccount(undefined);
  await app.switchAccount("account-b");
  assert.equal(app.value.busyCategory, null);
  await act(async () => { token.resolve("old-token"); await action; });
  assert.equal(app.registrations.length, 1);
  assert.equal(app.registrations[0][0], "account-b");
  assert.deepEqual(app.saves, []);
  assert.deepEqual(app.value.preferences, defaults);
});

test("cada sesión recupera sus propias preferencias del servidor", async t => {
  const app = await setup(t, { load: async token => ({ ...defaults, weeklySummary: token === "account-a" }) });
  assert.equal(app.value.preferences.weeklySummary, true);
  await app.switchAccount("account-b");
  assert.deepEqual(app.loads, ["account-a", "account-b"]);
  assert.equal(app.value.preferences.weeklySummary, false);
});

test("un fallo de carga no permite sobrescribir preferencias desconocidas", async t => {
  const app = await setup(t, { load: async () => { throw new Error("offline"); } });
  await act(async () => { await app.value.setCategory("weeklySummary", true); });
  assert.equal(app.value.preferencesReady, false);
  assert.equal(app.saves.length, 0);
});

test("la guarda sincrónica impide dos activaciones simultáneas", async t => {
  const token = deferred(); const app = await setup(t, { getToken: () => token.promise });
  let first;
  await act(async () => {
    first = app.value.setCategory("weeklySummary", true);
    await app.value.setCategory("functionReports", true);
    await flush();
  });
  await act(async () => { token.resolve("token"); await first; });
  assert.equal(app.saves.length, 1);
  assert.equal(app.saves[0][0].weeklySummary, true);
  assert.equal(app.saves[0][0].functionReports, false);
});
