import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { readJson, RequestValidationError } from "../http.mjs";
import { createGuards } from "../agent-service/guards.mjs";
import { deviceRegistrationSchema, notificationPreferencesSchema, timezoneSchema } from "../../shared/notifications.ts";
import { ServiceError, bearer } from "./adapters.mjs";

const closureSchema = z.object({
  accountId: z.string().min(1).max(200), userId: z.string().min(1).max(200),
  functionId: z.string().min(1).max(200), eventId: z.string().min(1).max(200).optional(),
  periodStart: z.iso.date(), periodEnd: z.iso.date(), timezone: timezoneSchema,
}).strict().refine(v => v.periodStart <= v.periodEnd);
const sameSecret = (a, b) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export const createNotificationHttpServer = ({ store, authenticate, internalSecret, allowedOrigin, timeoutMs = 25_000, logger = console }) => {
  const guards = createGuards({ maxConcurrent: 20, maxGlobalPerWindow: 3_000, maxPerWindow: 120 });
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
    const disconnect = () => { if (!response.writableEnded) controller.abort(); };
    response.on("close", disconnect);
    let release;
    const json = (status, data) => {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": requestId,
        ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}) });
      response.end(data === undefined ? undefined : JSON.stringify(data));
    };
    try {
      if (request.method === "GET" && request.url === "/health") { json(200, { ok: true }); return; }
      if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        json(204); return;
      }
      release = guards.acquireGlobal();
      const path = new URL(request.url, "http://localhost").pathname;
      if (path === "/internal/function-closed" && request.method === "POST") {
        if (!internalSecret || !sameSecret(bearer(request), internalSecret)) throw new ServiceError(401, "No autorizado.");
        const event = closureSchema.parse(await readJson(request, controller.signal));
        if (!store.preferences(event).functionReports) { json(204); return; }
        const reportId = store.enqueue({ ...event, type: "function_report" });
        json(202, { data: { reportId } }); return;
      }
      const identity = await authenticate(request, controller.signal);
      controller.signal.throwIfAborted();
      guards.acquireSession(`${identity.accountId}:${identity.userId}`);
      if (path === "/api/v1/notification-preferences") {
        if (request.method === "GET") { json(200, { data: store.preferences(identity) }); return; }
        if (request.method === "PUT") {
          const value = notificationPreferencesSchema.parse(await readJson(request, controller.signal));
          store.setPreferences(identity, value); json(200, { data: value }); return;
        }
      }
      if (path === "/api/v1/devices" && request.method === "POST") {
        const registration = deviceRegistrationSchema.parse(await readJson(request, controller.signal));
        store.register(identity, registration); json(204); return;
      }
      if (path.startsWith("/api/v1/devices/") && request.method === "DELETE") {
        store.unregister(identity, decodeURIComponent(path.slice("/api/v1/devices/".length))); json(204); return;
      }
      if (path.startsWith("/api/v1/reports/") && request.method === "GET") {
        const snapshot = store.report(identity, decodeURIComponent(path.slice("/api/v1/reports/".length)));
        if (!snapshot) throw new ServiceError(404, "Este informe no está disponible.");
        json(200, { data: snapshot }); return;
      }
      throw new ServiceError(404, "Ruta no encontrada.");
    } catch (error) {
      const status = controller.signal.aborted ? 504 : error instanceof z.ZodError || error instanceof RequestValidationError || error instanceof URIError ? 400 : error.status ?? error.httpStatus ?? 500;
      if (!request.complete) { response.setHeader("Connection", "close"); response.once("finish", () => request.destroy()); }
      if (status === 500) logger.error?.("notification_request_failed", { requestId });
      if (error.retryAfterSeconds) response.setHeader("Retry-After", String(error.retryAfterSeconds));
      json(status, { error: status === 400 ? "Solicitud inválida." : status === 504 ? "El servicio tardó demasiado." : error instanceof ServiceError ? error.message : "No se pudo completar la solicitud.", requestId });
    } finally { clearTimeout(timeout); response.off("close", disconnect); release?.(); }
  });
};
