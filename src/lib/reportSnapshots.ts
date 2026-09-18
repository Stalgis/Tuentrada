import { env } from "./env";
import { notificationFetch } from "./pushApi";
import { reportSnapshotSchema, type ReportSnapshot } from "../../shared/notifications";
export type { ReportSnapshot };
export type ReportSnapshotStatus = ReportSnapshot["status"];
export const REPORTS_BACKEND_READY = Boolean(env.notificationsApiUrl);
export class ReportUnavailableError extends Error {
  constructor() { super("Los informes todavía no están disponibles."); this.name = "ReportUnavailableError"; }
}
export class ReportNotFoundError extends Error {
  constructor() { super("Este informe ya no está disponible."); this.name = "ReportNotFoundError"; }
}
export class ReportForbiddenError extends Error {
  constructor() { super("Tu cuenta no tiene acceso a este informe."); this.name = "ReportForbiddenError"; }
}
export const fetchReportSnapshot = async (accessToken: string, reportId: string, signal?: AbortSignal): Promise<ReportSnapshot> => {
  if (!REPORTS_BACKEND_READY) throw new ReportUnavailableError();
  try {
    const data = await notificationFetch(`/api/v1/reports/${encodeURIComponent(reportId)}`, accessToken, { method: "GET", signal });
    const snapshot = reportSnapshotSchema.parse(data);
    if (snapshot.reportId !== reportId) throw new Error("El servidor devolvió un informe distinto al solicitado.");
    return snapshot;
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 403) throw new ReportForbiddenError();
    if (status === 404) throw new ReportNotFoundError();
    throw error;
  }
};
