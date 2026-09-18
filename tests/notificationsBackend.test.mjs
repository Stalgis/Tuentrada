import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NotificationStore } from "../server/notification-service/store.mjs";
import { createNotificationWorker, weeklyPeriod } from "../server/notification-service/worker.mjs";
import { createNotificationHttpServer } from "../server/notification-service/httpServer.mjs";
import { createIdentityAdapter, createExpoTransport } from "../server/notification-service/adapters.mjs";
import { reportSnapshotSchema } from "../shared/notifications.ts";
const MONDAY = Date.parse("2026-09-14T12:00:00Z");
const identity = { accountId: "account-a", userId: "user-a", sessionId: "session-a", timezone: "America/Argentina/Buenos_Aires", expiresAt: "2026-09-20T12:00:00Z" };
const device = { expoPushToken: "ExpoPushToken[test-device]", platform: "android", appVersion: "1", timezone: identity.timezone, language: "es" };
const metrics = { entradasPagas: 10, invitaciones: 2, entradasTotales: 12, recaudacionARS: 10000, precioPromedioARS: 1000, compradoresUnicos: 8 };
const setup = (t, { path, source, transport } = {}) => {
  let clock = MONDAY;
  const store = new NotificationStore(path);
  t.after(() => store.close());
  store.setPreferences(identity, { functionReports: true, weeklySummary: true });
  store.register(identity, device, clock);
  const sent = [];
  const worker = createNotificationWorker({ store, now: () => clock,
    source: source ?? (async () => ({ metrics })),
    transport: transport ?? { send: async message => { sent.push(message); return { status: "ok", id: `ticket-${sent.length}` }; }, receipts: async ids => Object.fromEntries(ids.map(id => [id, { status: "ok" }])) }, logger: { error() {} },
  });
  return { store, worker, sent, advance: ms => { clock += ms; } };
};

test("semana cerrada según zona de la cuenta, lunes a las 09:00", () => {
  assert.equal(weeklyPeriod(MONDAY - 1, identity.timezone), null);
  assert.deepEqual(weeklyPeriod(MONDAY, identity.timezone), { periodStart: "2026-09-07", periodEnd: "2026-09-13" });
  assert.deepEqual(weeklyPeriod(MONDAY + 86400000, identity.timezone), { periodStart: "2026-09-07", periodEnd: "2026-09-13" });
});

test("genera un snapshot y un aviso, aunque el scheduler se ejecute dos veces", async t => {
  const app = setup(t);
  await app.worker.tick(); await app.worker.tick();
  assert.equal(app.sent.length, 1);
  const report = app.store.report(identity, app.sent[0].data.reportId);
  assert.deepEqual(report.metrics, metrics);
  assert.equal(report.periodEnd, "2026-09-13");
  assert.equal(report.status, "ready");
  assert.deepEqual(Object.keys(app.sent[0].data).sort(), ["reportId", "type", "v"]);
  assert.ok(!JSON.stringify(app.sent[0]).includes("10000"));
  assert.equal(app.store.report({ ...identity, userId: "other" }, report.reportId), null);
  assert.equal(app.store.report({ ...identity, accountId: "other" }, report.reportId), null);
  app.advance(15 * 60000); await app.worker.tick();
  assert.deepEqual(app.store.stats().deliveries.map(d => ({ ...d })), [{ status: "accepted", count: 1 }]);
});

test("un reinicio conserva informes y la deduplicación", async t => {
  const directory = mkdtempSync(join(tmpdir(), "tuentrada-notifications-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "reports.sqlite");
  const first = new NotificationStore(path);
  const input = { ...identity, type: "weekly_report", periodStart: "2026-09-07", periodEnd: "2026-09-13" };
  const id = first.enqueue(input); first.close();
  const second = new NotificationStore(path);
  assert.equal(second.enqueue(input), id);
  assert.equal(second.report(identity, id).status, "generating");
  second.close();
});

test("cambio de dueño cancela una entrega pendiente de la cuenta anterior", async t => {
  let app;
  app = setup(t, { transport: { send: async () => { throw Object.assign(new Error(), { retryable: true }); }, receipts: async () => ({}) } });
  await app.worker.tick();
  app.store.register({ ...identity, accountId: "account-b", userId: "user-b", sessionId: "session-b" }, device, MONDAY);
  app.advance(120000); await app.worker.tick();
  assert.equal(app.store.stats().deliveries[0].status, "cancelled");
});

test("un logout viejo no borra el dispositivo de una nueva sesión", t => {
  const { store } = setup(t);
  store.register({ ...identity, sessionId: "new" }, device, MONDAY);
  store.unregister(identity, device.expoPushToken);
  assert.equal(store.subscribers(MONDAY).length, 1);
  store.unregister({ ...identity, sessionId: "new" }, device.expoPushToken);
  assert.equal(store.subscribers(MONDAY).length, 0);
});

test("revocar preferencia antes del reintento evita el envío", async t => {
  const app = setup(t, { transport: { send: async () => { throw Object.assign(new Error(), { retryable: true }); }, receipts: async () => ({}) } });
  await app.worker.tick();
  app.store.setPreferences(identity, { functionReports: false, weeklySummary: false });
  app.advance(120000); await app.worker.tick();
  assert.equal(app.store.stats().deliveries[0].status, "cancelled");
});

test("un resultado de envío incierto no se reenvía a ciegas", async t => {
  let attempts = 0;
  const app = setup(t, { transport: { send: async () => { attempts++; throw Object.assign(new Error(), { ambiguous: true }); }, receipts: async () => ({}) } });
  await app.worker.tick(); app.advance(120000); await app.worker.tick();
  assert.equal(attempts, 1);
  assert.equal(app.store.stats().deliveries[0].status, "unknown");
});

test("DeviceNotRegistered en receipt desactiva el dispositivo", async t => {
  const app = setup(t, { transport: { send: async () => ({ status: "ok", id: "gone" }), receipts: async () => ({ gone: { status: "error", details: { error: "DeviceNotRegistered" } } }) } });
  await app.worker.tick(); app.advance(15 * 60000); await app.worker.tick();
  assert.equal(app.store.subscribers(MONDAY).length, 0);
  assert.equal(app.store.stats().deliveries[0].status, "failed");
});

test("una generación fallida no envía nada y reintenta", async t => {
  let calls = 0;
  const app = setup(t, { source: async () => { if (calls++ === 0) throw new Error(); return { metrics }; } });
  await app.worker.tick(); assert.equal(app.sent.length, 0);
  app.advance(120000); await app.worker.tick(); assert.equal(app.sent.length, 1);
});

test("contrato rechaza snapshot listo sin contenido y fechas inexistentes", () => {
  const report = { schemaVersion: 1, reportId: "id", type: "weekly_report", status: "ready", periodStart: "2026-09-01", periodEnd: "2026-09-07", timezone: identity.timezone };
  assert.equal(reportSnapshotSchema.safeParse(report).success, false);
  assert.equal(reportSnapshotSchema.safeParse({ ...report, generatedAt: new Date(MONDAY).toISOString(), metrics }).success, true);
  assert.equal(reportSnapshotSchema.safeParse({ ...report, status: "generating", periodEnd: "2026-02-30" }).success, false);
});

test("API usa identidad validada; no permite asignar dueño en el body", async t => {
  const { store } = setup(t);
  const server = createNotificationHttpServer({ store, internalSecret: "trusted-secret", authenticate: async request => {
    if (request.headers.authorization !== "Bearer valid") throw Object.assign(new Error(), { status: 401 });
    return { ...identity, expiresAt: new Date(Date.now() + 3600000).toISOString() };
  } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${url}/api/v1/notification-preferences`)).status, 401);
  const get = await fetch(`${url}/api/v1/notification-preferences`, { headers: { Authorization: "Bearer valid" } });
  assert.equal((await get.json()).data.weeklySummary, true);
  const malicious = await fetch(`${url}/api/v1/devices`, { method: "POST", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" }, body: JSON.stringify({ ...device, accountId: "another" }) });
  assert.equal(malicious.status, 400);
  const closure = { ...identity, functionId: "f1", periodStart: "2026-09-01", periodEnd: "2026-09-14" };
  delete closure.sessionId; delete closure.expiresAt;
  const publish = () => fetch(`${url}/internal/function-closed`, { method: "POST", headers: { Authorization: "Bearer trusted-secret", "Content-Type": "application/json" }, body: JSON.stringify(closure) });
  const a = await (await publish()).json(); const b = await (await publish()).json();
  assert.equal(a.data.reportId, b.data.reportId);
});

test("identidad sólo procede del upstream y exige expiración válida", async () => {
  const adapter = createIdentityAdapter({ url: "https://identity.invalid/me", fetchImpl: async () => Response.json({ data: { ...identity, expiresAt: new Date(Date.now() + 60000).toISOString() } }) });
  const value = await adapter({ headers: { authorization: "Bearer opaque" } });
  assert.equal(value.accountId, "account-a");
  assert.notEqual(value.sessionId, "opaque");
  await assert.rejects(() => adapter({ headers: {} }), e => e.status === 401);
  const expired = createIdentityAdapter({ url: "https://identity.invalid/me", fetchImpl: async () => Response.json({ data: { ...identity, expiresAt: "2000-01-01T00:00:00Z" } }) });
  await assert.rejects(() => expired({ headers: { authorization: "Bearer opaque" } }), e => e.status === 401);
});

test("transporte Expo distingue 429, timeout incierto y ticket", async () => {
  const limited = createExpoTransport({ fetchImpl: async () => new Response("", { status: 429 }) });
  await assert.rejects(() => limited.send({}), e => e.retryable === true);
  const offline = createExpoTransport({ fetchImpl: async () => { throw new Error(); } });
  await assert.rejects(() => offline.send({}), e => e.ambiguous === true);
  const ok = createExpoTransport({ fetchImpl: async () => Response.json({ data: [{ status: "ok", id: "ticket" }] }) });
  assert.equal((await ok.send({})).id, "ticket");
});
