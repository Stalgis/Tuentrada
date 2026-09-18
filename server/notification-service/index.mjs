import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NotificationStore } from "./store.mjs";
import { createNotificationWorker } from "./worker.mjs";
import { createNotificationHttpServer } from "./httpServer.mjs";
import { createExpoTransport, createIdentityAdapter, createSourceAdapter } from "./adapters.mjs";

const required = name => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}. Ver server/notification-service/README.md.`);
  return value;
};
const endpoint = name => {
  const value = required(name);
  const url = new URL(value);
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error(`${name} debe usar HTTPS en producción y no incluir credenciales.`);
  return value;
};
const identityUrl = endpoint("NOTIFICATION_IDENTITY_URL");
const sourceUrl = endpoint("NOTIFICATION_REPORT_SOURCE_URL");
const serviceToken = required("NOTIFICATION_REPORT_SOURCE_TOKEN");
const internalSecret = required("NOTIFICATION_INTERNAL_SECRET");
if (internalSecret.length < 32) throw new Error("NOTIFICATION_INTERNAL_SECRET debe tener al menos 32 caracteres aleatorios.");
const path = resolve(process.env.NOTIFICATION_DB_PATH || "var/notifications.sqlite");
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const store = new NotificationStore(path);
const worker = createNotificationWorker({ store, source: createSourceAdapter({ url: sourceUrl, serviceToken }), transport: createExpoTransport({ accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN }) });
const server = createNotificationHttpServer({
  store, internalSecret, allowedOrigin: process.env.NOTIFICATION_ALLOWED_ORIGIN,
  authenticate: createIdentityAdapter({ url: identityUrl, apiKey: process.env.REPORT_API_KEY }),
});
let activeTick = null;
let stopping = false;
const tick = () => {
  if (stopping || activeTick) return;
  activeTick = worker.tick().catch(() => console.error("notification_tick_failed")).finally(() => { activeTick = null; });
};
const interval = setInterval(tick, 30_000);
server.listen(Number(process.env.NOTIFICATION_PORT || 8788), process.env.NOTIFICATION_HOST || "127.0.0.1", () => {
  console.log("Notification service ready (reports, devices, preferences, worker)"); tick();
});
const shutdown = async () => {
  stopping = true; clearInterval(interval);
  await new Promise(resolve => server.close(resolve));
  await activeTick;
  store.close();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
