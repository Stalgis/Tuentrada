import { reportMetricsSchema } from "../../shared/notifications.ts";

/** Calendario de la cuenta. El reloj del servidor nunca define el período. */
export const weeklyPeriod = (now, timezone) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now));
  const part = name => parts.find(p => p.type === name).value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  const dow = date.getUTCDay() || 7;
  // Lunes antes de 09:00 aún no toca; a partir del lunes permite recuperar
  // una ejecución perdida durante la semana sin crear dos informes.
  if (dow === 1 && Number(part("hour")) < 9) return null;
  date.setUTCDate(date.getUTCDate() - dow + 1);
  const end = new Date(date); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(date); start.setUTCDate(start.getUTCDate() - 7);
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
};

export const notificationMessage = (snapshot, token) => ({
  to: token,
  title: snapshot.type === "weekly_report" ? "Tu resumen semanal está listo" : "Tu informe está listo",
  body: "Abrí Tuentrada para consultar el informe.",
  channelId: snapshot.type === "weekly_report" ? "weekly-reports" : "event-reports",
  ttl: 3_600,
  data: { v: 1, type: snapshot.type, reportId: snapshot.reportId },
});

export const createNotificationWorker = ({ store, source, transport, now = Date.now, logger = console }) => {
  let working = false;
  return {
    async tick() {
      if (working) return;
      working = true;
      try {
        const clock = now();
        for (const subscriber of store.subscribers(clock)) {
          const period = weeklyPeriod(clock, subscriber.timezone);
          if (period) store.enqueue({ accountId: subscriber.account_id, userId: subscriber.user_id, timezone: subscriber.timezone, type: "weekly_report", ...period });
        }
        for (let i = 0; i < 10; i++) {
          const job = store.claimJob(now());
          if (!job) break;
          try {
            // El adaptador valida permisos y devuelve agregados del usuario,
            // nunca recibe un token persistido del teléfono.
            const data = await source({ accountId: job.account_id, userId: job.user_id, type: job.type,
              periodStart: job.period_start, periodEnd: job.period_end, timezone: job.timezone,
              functionId: job.function_id, eventId: job.event_id });
            const metrics = reportMetricsSchema.parse(data.metrics);
            store.completeJob(job, {
              schemaVersion: 1, reportId: job.id, type: job.type, status: "ready", generatedAt: new Date(now()).toISOString(),
              periodStart: job.period_start, periodEnd: job.period_end, timezone: job.timezone, metrics,
              ...(data.eventName ? { eventName: data.eventName } : {}),
              ...(job.function_id ? { functionId: job.function_id } : {}), ...(job.event_id ? { eventId: job.event_id } : {}),
            }, now());
          } catch { store.failJob(job, now()); logger.error?.("report_generation_failed", { reportId: job.id }); }
        }
        for (let i = 0; i < 100; i++) {
          const delivery = store.claimDelivery(now());
          if (!delivery) break;
          const context = store.deliveryContext(delivery, now());
          if (!context) { store.markDelivery(delivery, "cancelled"); continue; }
          try {
            const ticket = await transport.send(notificationMessage(context.snapshot, delivery.token));
            if (ticket.status === "ok" && typeof ticket.id === "string") store.ticket(delivery, ticket.id, now());
            else if (ticket.details?.error === "DeviceNotRegistered") {
              store.invalidateDevice(delivery); store.markDelivery(delivery, "failed", "DeviceNotRegistered");
            } else if (ticket.details?.error === "MessageRateExceeded" && delivery.attempts < 5) {
              store.markDelivery(delivery, "pending", "MessageRateExceeded", now() + 30_000 * 2 ** delivery.attempts);
            } else store.markDelivery(delivery, "failed", ticket.details?.error ?? "INVALID_TICKET");
          } catch (error) {
            if (error.retryable && delivery.attempts < 5) store.markDelivery(delivery, "pending", "EXPO_UNAVAILABLE", now() + 30_000 * 2 ** delivery.attempts);
            else store.markDelivery(delivery, error.ambiguous ? "unknown" : "failed", "SEND_ERROR");
          }
        }
        const pending = store.receipts(now());
        if (pending.length) {
          try {
            const receipts = await transport.receipts(pending.map(d => d.ticket_id));
            for (const delivery of pending) {
              const receipt = receipts[delivery.ticket_id];
              if (receipt?.status === "ok") store.receipt(delivery, "accepted");
              else if (receipt?.status === "error") {
                if (receipt.details?.error === "DeviceNotRegistered") store.invalidateDevice(delivery);
                store.receipt(delivery, "failed", receipt.details?.error ?? "PROVIDER_ERROR");
              } else store.receipt(delivery, now() - delivery.ticket_at >= 23 * 3_600_000 ? "unknown" : "ticket", "RECEIPT_MISSING", now() + 15 * 60_000);
            }
          } catch {
            for (const delivery of pending) store.receipt(delivery, now() - delivery.ticket_at >= 23 * 3_600_000 ? "unknown" : "ticket", "RECEIPT_UNAVAILABLE", now() + 15 * 60_000);
          }
        }
      } finally { working = false; }
    },
  };
};
