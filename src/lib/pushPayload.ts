import { z } from "zod";

/**
 * Payload de una notificación de informe.
 *
 * El aviso nunca trae el informe ni el token de sesión: solo los
 * identificadores mínimos para llegar a la pantalla correcta. Ver
 * `docs` del plan de notificaciones.
 *
 * Android entrega los `data` de FCM como strings, así que todo campo
 * numérico se coacciona en vez de exigirse como número.
 */

/** Versión de formato que esta build sabe interpretar. */
export const SUPPORTED_PAYLOAD_VERSION = 1;

export const REPORT_NOTIFICATION_TYPES = [
  "function_report",
  "event_report",
  "weekly_report",
] as const;

export type ReportNotificationType = (typeof REPORT_NOTIFICATION_TYPES)[number];

export type NotificationDestination = {
  type: ReportNotificationType;
  reportId: string;
  functionId?: string;
  eventId?: string;
  periodStart?: string;
  periodEnd?: string;
};

// Android puede mandar los campos ausentes como cadena vacía; se leen como
// ausentes en vez de invalidar el payload entero.
const nonEmpty = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const payloadSchema = z.object({
  type: z.enum(REPORT_NOTIFICATION_TYPES),
  reportId: z.string().trim().min(1),
  functionId: nonEmpty,
  eventId: nonEmpty,
  periodStart: nonEmpty,
  periodEnd: nonEmpty,
  // Ausente se lee como v1: el primer backend puede no mandarla todavía.
  v: z.coerce.number().int().positive().default(SUPPORTED_PAYLOAD_VERSION),
});

/**
 * Traduce el `data` de una notificación a un destino de navegación.
 *
 * Devuelve `null` ante cualquier payload que esta build no pueda honrar
 * —tipo desconocido, `reportId` faltante, formato más nuevo—. Abrir la app
 * sin navegar es correcto; adivinar una pantalla no lo es.
 */
export const parseNotificationDestination = (
  data: unknown,
): NotificationDestination | null => {
  const parsed = payloadSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }

  const { v, ...destination } = parsed.data;
  if (v > SUPPORTED_PAYLOAD_VERSION) {
    return null;
  }

  return destination;
};

/** Título de pantalla para cada tipo de informe. */
export const reportTitle = (type: ReportNotificationType): string => {
  switch (type) {
    case "function_report":
      return "Informe de función";
    case "event_report":
      return "Informe del evento";
    case "weekly_report":
      return "Resumen semanal";
  }
};
