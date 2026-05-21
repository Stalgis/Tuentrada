import * as Sentry from "@sentry/react-native";
import { env } from "./env";
import type { Event, EventStatus } from "./types";

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

// ─── Unauthorized callback ────────────────────────────────────────────────────
// AuthProvider registers logout here so any 401 across the app triggers logout.

let onUnauthorizedCallback: (() => void) | null = null;
export const setOnUnauthorized = (cb: (() => void) | null): void => {
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
  // Only used when date === "custom"
  dTo?: string;
};

const buildQuery = (params: ReportParams): string => {
  const qs = new URLSearchParams();
  if (params.id != null && params.id !== "") qs.set("id", params.id);
  if (params.date) qs.set("date", params.date);
  if (params.date === "custom" && params.dTo) qs.set("dTo", params.dTo);
  const out = qs.toString();
  return out ? `?${out}` : "";
};

const apiFetch = async <T>(
  path: string,
  token: string,
  params: ReportParams = {},
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}${buildQuery(params)}`, {
    method: "GET",
    headers: makeHeaders(token),
  });

  if (res.status === 401) {
    onUnauthorizedCallback?.();
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

// ─── Endpoints ────────────────────────────────────────────────────────────────

type EventListResponse = { resources: Record<string, string> };

export const fetchEventList = async (token: string): Promise<Event[]> => {
  const data = await apiFetch<EventListResponse>(
    "/api/v1/report/event-list",
    token,
  );
  const resources = data?.resources ?? {};
  return Object.entries(resources).map(([id, nameDate]) => {
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
  params: ReportParams = {},
): Promise<StatsData> => {
  const data = await apiFetch<{ stats: StatsData }>(
    "/api/v1/report/stats",
    token,
    params,
  );
  return data.stats;
};

export const fetchOnlineSales = async (
  token: string,
  eventId: string,
): Promise<Sector[]> => {
  const data = await apiFetch<{ "online-sales": Sector[] }>(
    "/api/v1/report/online-sales",
    token,
    { id: eventId },
  );
  return data["online-sales"] ?? [];
};

export const fetchHistory = async (
  token: string,
  params: ReportParams = {},
): Promise<HistoryResult> => {
  const data = await apiFetch<{ history: HistoryDay[] }>(
    "/api/v1/report/history",
    token,
    params,
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
  params: ReportParams = {},
): Promise<PaymentRow[]> => {
  const data = await apiFetch<{ payments: PaymentRowRaw[] }>(
    "/api/v1/report/payments",
    token,
    params,
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
    await fetch(`${BASE_URL}/api/v1/logout`, {
      method: "POST",
      headers: makeHeaders(token),
    });
  } catch {
    // Fire-and-forget
  }
};
