import * as Sentry from "@sentry/react-native";
import { env } from "./env";
import { currentGeneration } from "./session";
import type { Event, EventStatus } from "./types";
import { backendFetch } from "./backendFetch";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ApiUnauthorizedError extends Error {
  constructor() {
    super("Sesión expirada. Iniciá sesión nuevamente.");
    this.name = "ApiUnauthorizedError";
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Sin esto, una petición que el servidor nunca contesta deja a la pantalla
 * cargando para siempre: la promesa no se asienta y los `finally` que apagan
 * los indicadores nunca corren.
 */
export class ApiTimeoutError extends Error {
  constructor() {
    super("El servidor tardó demasiado en responder.");
    this.name = "ApiTimeoutError";
  }
}

// ─── Unauthorized callback ────────────────────────────────────────────────────
// AuthProvider registers logout here so any 401 across the app triggers logout.

// El callback recibe la generación de sesión que originó la petición, para que
// un 401 tardío de una sesión anterior no cierre la sesión vigente.
let onUnauthorizedCallback: ((gen: number) => void) | null = null;
export const setOnUnauthorized = (cb: ((gen: number) => void) | null): void => {
  onUnauthorizedCallback = cb;
};

// ─── Shared fetch helper ──────────────────────────────────────────────────────

const BASE_URL = env.baseUrl;

const makeHeaders = (token: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
  "x-api-key": env.apiKey,
});

export type ReportParams = {
  id?: string;
  date?: string;
  // Only used when date === "custom". `dTo` remains for legacy callers.
  dateFrom?: string;
  dateTo?: string;
  dTo?: string;
};

const buildQuery = (params: ReportParams): string => {
  const qs = new URLSearchParams();
  if (params.id != null && params.id !== "") qs.set("id", params.id);
  if (params.date) qs.set("date", params.date);
  if (params.date === "custom" && params.dateFrom)
    qs.set("dateFrom", params.dateFrom);
  if (params.date === "custom" && params.dateTo)
    qs.set("dateTo", params.dateTo);
  if (params.date === "custom" && params.dTo) qs.set("dTo", params.dTo);
  const out = qs.toString();
  return out ? `?${out}` : "";
};

// Las peticiones sanas de este backend responden en 1-2s; el gateway corta a
// los ~31s con un 504. Cortamos antes para no dejar la UI colgada medio minuto.
const REQUEST_TIMEOUT_MS = 20_000;

const apiFetch = async <T>(
  path: string,
  token: string,
  params: ReportParams = {},
  request: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> => {
  // Generación capturada antes de salir: identifica a qué sesión pertenece
  // esta petición cuando la respuesta llegue.
  const gen = currentGeneration();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await backendFetch(`${BASE_URL}${path}${buildQuery(params)}`, {
      method: request.method ?? "GET",
      headers: makeHeaders(token),
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
    });

    if (res.status === 401) {
      onUnauthorizedCallback?.(gen);
      throw new ApiUnauthorizedError();
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      throw new ApiError(res.status, "Respuesta inválida del servidor");
    }

    if (!res.ok || json?.success === false) {
      const message =
        typeof json?.message === "string"
          ? json.message
          : "Error en la solicitud";
      const error = new ApiError(res.status, message);
      if (res.status >= 500) {
        Sentry.captureException(error, { extra: { path, status: res.status } });
      }
      throw error;
    }

    return json.data as T;
  } catch (error) {
    // El abort llega como excepción del fetch: la traducimos a un error propio
    // para que la UI pueda distinguirla y ofrecer reintentar.
    if (controller.signal.aborted) {
      const timeout = new ApiTimeoutError();
      Sentry.captureException(timeout, {
        extra: { path, date: params.date, timeoutMs: REQUEST_TIMEOUT_MS },
      });
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatsData = {
  tickets: number;
  invitations: number;
  total_tickets: number;
  total: number;
  ticket_medio: number;
  unique_buyers: number;
  chartTickets: number[];
  chartInvitations: number[];
  chartTotalTickets: number[];
  chartTotal: number[];
  chartUniqueBuyers: number[];
};

export type Sector = {
  price_type: string;
  available: number;
  kill: number;
  purchase: number;
  invitation: number;
  booking: number;
  issue: number;
  promoter_blocked: number;
  in_progress: number;
  session_pack: number;
  total: number;
  is_total_general: boolean;
};

export type HistoryDay = {
  day_date: string;
  day_formatted: string;
  sold_tickets: number;
  sold_guest: number;
  total_tickets: number;
  total_net: number;
};

export type HistoryResult = {
  rows: HistoryDay[];
  total: HistoryDay | null;
};

export type PaymentRow = {
  payment_name: string;
  sold_tickets: number;
  total_revenue: number;
};

const normalizeIds = (ids: string[]): (string | number)[] =>
  [...new Set(ids)].map((id) => {
    const numericId = Number(id);
    return Number.isSafeInteger(numericId) ? numericId : id;
  });

// ─── Endpoints ────────────────────────────────────────────────────────────────

type EventListResource = { id: number | string; label: string };
type EventListResponse = {
  // El backend puede devolver `resources` como array de {id, label} (formato
  // actual) o como mapa { id: "label" } (formato viejo). Soportamos ambos.
  resources: Record<string, string> | EventListResource[];
};

export const fetchEventList = async (token: string): Promise<Event[]> => {
  const data = await apiFetch<EventListResponse>(
    "/api/v2/report/event-list",
    token,
  );
  const resources = data?.resources ?? {};
  const entries: [string, string][] = Array.isArray(resources)
    ? resources.map((r) => [String(r.id), r.label])
    : Object.entries(resources);

  return entries.map(([id, nameDate]) => {
    const dashIndex = nameDate.lastIndexOf(" - ");
    const name =
      dashIndex >= 0 ? nameDate.slice(0, dashIndex).trim() : nameDate;
    const dateStr = dashIndex >= 0 ? nameDate.slice(dashIndex + 3).trim() : "";
    const dateISO = dateStr ? dateStr.replace(" ", "T") + "-03:00" : "";
    const isPast = dateISO ? new Date(dateISO).getTime() < Date.now() : false;
    return {
      id,
      name,
      venue: "",
      city: "",
      dateISO,
      status: (isPast ? "finished" : "on_sale") as EventStatus,
      ticketsSold: 0,
      ticketsAvailable: 0,
      ticketPriceARS: 0,
    };
  });
};

export const fetchStats = async (
  token: string,
  ids: string[],
  params: ReportParams = {},
): Promise<StatsData> => {
  const normalizedIds = normalizeIds(ids);
  const data = await apiFetch<{ stats: StatsData }>(
    "/api/v2/report/stats",
    token,
    params,
    { method: "POST", body: { ids: normalizedIds } },
  );
  return data.stats;
};

export const fetchOnlineSales = async (
  token: string,
  eventId: string,
): Promise<Sector[]> => {
  const data = await apiFetch<{ "online-sales": Sector[] }>(
    "/api/v2/report/online-sales",
    token,
    { id: eventId },
  );
  return data["online-sales"] ?? [];
};

export const fetchHistory = async (
  token: string,
  ids: string[],
  params: ReportParams = {},
): Promise<HistoryResult> => {
  const normalizedIds = normalizeIds(ids);
  const data = await apiFetch<{ history: HistoryDay[] }>(
    "/api/v2/report/history",
    token,
    params,
    { method: "POST", body: { ids: normalizedIds } },
  );
  const all = data?.history ?? [];
  const totalIdx = all.findIndex((row) => row.day_formatted === "TOTAL");
  if (totalIdx === -1) return { rows: all, total: null };
  const rows = [...all.slice(0, totalIdx), ...all.slice(totalIdx + 1)];
  return { rows, total: all[totalIdx] };
};

type PaymentRowRaw = {
  payment_name: string;
  sold_tickets: number;
  total_revenue: string | number;
};

export const fetchPayments = async (
  token: string,
  ids: string[],
  params: ReportParams = {},
): Promise<PaymentRow[]> => {
  const normalizedIds = normalizeIds(ids);
  const data = await apiFetch<{ payments: PaymentRowRaw[] }>(
    "/api/v2/report/payments",
    token,
    params,
    { method: "POST", body: { ids: normalizedIds } },
  );
  const payments = data?.payments ?? [];
  return payments.map((p) => ({
    payment_name: p.payment_name,
    sold_tickets: Number(p.sold_tickets) || 0,
    total_revenue:
      typeof p.total_revenue === "string"
        ? Number(p.total_revenue) || 0
        : p.total_revenue,
  }));
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logoutApi = async (token: string): Promise<void> => {
  try {
    await backendFetch(`${BASE_URL}/api/v1/logout`, {
      method: "POST",
      headers: makeHeaders(token),
    });
  } catch {
    // Fire-and-forget
  }
};
