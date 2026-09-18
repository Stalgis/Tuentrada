import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  functionReports: z.boolean(),
  weeklySummary: z.boolean(),
}).strict();
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  functionReports: false,
  weeklySummary: false,
};
export const timezoneSchema = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Zona horaria inválida");
const id = z.string().trim().min(1).max(200);
export const expoPushTokenSchema = z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/);
export const deviceRegistrationSchema = z.object({
  expoPushToken: expoPushTokenSchema,
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().min(1).max(50),
  timezone: timezoneSchema,
  language: z.literal("es"),
}).strict();
export const reportMetricsSchema = z.object({
  entradasPagas: z.number().int().nonnegative(),
  invitaciones: z.number().int().nonnegative(),
  entradasTotales: z.number().int().nonnegative(),
  recaudacionARS: z.number().finite(),
  precioPromedioARS: z.number().finite(),
  compradoresUnicos: z.number().int().nonnegative(),
}).strict();
export const reportSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  reportId: id,
  type: z.enum(["function_report", "event_report", "weekly_report"]),
  status: z.enum(["generating", "ready", "failed"]),
  generatedAt: z.iso.datetime({ offset: true }).optional(),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  timezone: timezoneSchema,
  eventName: z.string().max(300).optional(),
  functionId: id.optional(),
  eventId: id.optional(),
  metrics: reportMetricsSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.periodStart > value.periodEnd) context.addIssue({ code: "custom", message: "Período invertido" });
  if (value.status === "ready" && (!value.metrics || !value.generatedAt)) {
    context.addIssue({ code: "custom", message: "Un informe listo requiere métricas y fecha de generación" });
  }
});
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
