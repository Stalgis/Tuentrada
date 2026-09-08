import { env } from "./env";
import { backendFetch } from "./backendFetch";
import { ApiTimeoutError, ApiUnauthorizedError, notifyUnauthorized } from "./reportApi";
import { currentGeneration } from "./session";
import type { ReportNotificationType } from "./pushPayload";

/**
 * Informes persistidos ("snapshots").
 *
 * Todavía no existen en el backend (fase 2 del plan): hoy todas las pantallas
 * consultan datos vivos, así que un informe abierto dos días después de su
 * aviso mostraría números distintos a los que lo originaron. Cuando el backend
 * exponga los endpoints alcanza con poner `REPORTS_BACKEND_READY` en `true`.
 */
export const REPORTS_BACKEND_READY = false;

export type ReportSnapshotStatus = "generating" | "ready" | "failed";

export type ReportSnapshot = {
  reportId: string;
  type: ReportNotificationType;
  status: ReportSnapshotStatus;
  generatedAt?: string;
  periodStart?: string;
  periodEnd?: string;
  eventName?: string;
  functionId?: string;
  eventId?: string;
};

export class ReportUnavailableError extends Error {
  constructor() {
    super("El informe todavía no está disponible en la app.");
    this.name = "ReportUnavailableError";
  }
}

export class ReportNotFoundError extends Error {
  constructor() {
    super("Este informe ya no está disponible.");
    this.name = "ReportNotFoundError";
  }
}

export class ReportForbiddenError extends Error {
  constructor() {
    super("Tu cuenta no tiene acceso a este informe.");
    this.name = "ReportForbiddenError";
  }
}

// Mismo tope que el resto del backend: sin esto, un servidor que nunca contesta
// deja el spinner del informe girando para siempre.
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * El backend revalida el acceso: que el `reportId` llegue por notificación no
 * autoriza nada. Un 403 se muestra como tal y nunca como "no encontrado", para
 * no filtrar si el informe existe en otra cuenta.
 */
export const fetchReportSnapshot = async (
  accessToken: string,
  reportId: string,
): Promise<ReportSnapshot> => {
  if (!REPORTS_BACKEND_READY) {
    throw new ReportUnavailableError();
  }

  // Generación capturada antes de salir: un 401 tardío de una sesión anterior
  // no puede cerrar la sesión vigente.
  const gen = currentGeneration();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await backendFetch(
      `${env.baseUrl}/api/v1/reports/${encodeURIComponent(reportId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-api-key": env.apiKey,
        },
        signal: controller.signal,
      },
    );

    if (response.status === 401) {
      // Igual que el resto de la app: un 401 cierra la sesión en vez de dejar
      // al usuario autenticado mirando un error.
      notifyUnauthorized(gen);
      throw new ApiUnauthorizedError();
    }
    if (response.status === 403) throw new ReportForbiddenError();
    if (response.status === 404) throw new ReportNotFoundError();
    if (!response.ok) throw new Error("No se pudo abrir el informe.");

    const json = (await response.json()) as { data: ReportSnapshot };
    return json.data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
