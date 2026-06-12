import type { Event, EventFunction } from "./types";
import {
  fetchEventList,
  fetchStats,
  fetchOnlineSales,
  fetchHistory,
  fetchPayments,
  type StatsData,
  type Sector,
  type HistoryResult,
  type PaymentRow,
  type ReportParams,
} from "./reportApi";

export type { StatsData, Sector, HistoryResult, PaymentRow, ReportParams };
export { ApiUnauthorizedError, ApiError } from "./reportApi";

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry<T> = { data: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}

function setCached<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export const invalidateEventsCache = (): void => cache.clear();

function groupEventsByName(flat: Event[]): Event[] {
  const order: string[] = [];
  const map = new Map<string, Event[]>();
  for (const ev of flat) {
    if (!map.has(ev.name)) {
      order.push(ev.name);
      map.set(ev.name, []);
    }
    map.get(ev.name)!.push(ev);
  }

  return order.map((name) => {
    const group = map.get(name)!;
    if (group.length === 1) {
      const ev = group[0];
      return {
        ...ev,
        functions: [{
          id: ev.id,
          dateISO: ev.dateISO,
          status: ev.status,
          ticketsSold: ev.ticketsSold,
          grossRevenueARS: ev.grossRevenueARS ?? 0,
          invitations: ev.invitations ?? 0,
        }],
      };
    }

    const sorted = [...group].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(),
    );
    const now = Date.now();
    const upcoming = sorted.find((e) => new Date(e.dateISO).getTime() >= now) ?? sorted[0];
    const allFinished = sorted.every((e) => e.status === "finished");
    const anySoldOut = sorted.some((e) => e.status === "sold_out");

    const functions: EventFunction[] = sorted.map((e) => ({
      id: e.id,
      dateISO: e.dateISO,
      status: e.status,
      ticketsSold: e.ticketsSold,
      grossRevenueARS: e.grossRevenueARS ?? 0,
      invitations: e.invitations ?? 0,
    }));

    const ticketsSold = sorted.reduce((s, e) => s + e.ticketsSold, 0);
    const grossRevenueARS = sorted.reduce((s, e) => s + (e.grossRevenueARS ?? 0), 0);

    return {
      ...upcoming,
      id: group[0].id,
      status: allFinished ? "finished" : anySoldOut ? "sold_out" : "on_sale",
      ticketsSold,
      ticketsAvailable: sorted.reduce((s, e) => s + e.ticketsAvailable, 0),
      grossRevenueARS,
      ticketPriceARS: ticketsSold > 0 ? grossRevenueARS / ticketsSold : 0,
      functions,
    };
  });
}

export type FunctionStats = { total: number; tickets: number; invitations: number };

// El backend solo expone stats por función (/stats?id=). Para tener recaudación
// y entradas reales por función, las pedimos en paralelo (en lotes) y cacheadas.
const fetchFunctionStatsMap = async (
  token: string,
  functionIds: string[],
  date: string = "all",
): Promise<Record<string, FunctionStats>> => {
  const CONCURRENCY = 8;
  const out: Record<string, FunctionStats> = {};
  for (let i = 0; i < functionIds.length; i += CONCURRENCY) {
    const batch = functionIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((id) =>
        fetchEventStats(token, id, date)
          .then((s) => ({ id, total: s.total ?? 0, tickets: s.tickets ?? 0, invitations: s.invitations ?? 0 }))
          .catch(() => ({ id, total: 0, tickets: 0, invitations: 0 })),
      ),
    );
    for (const r of results) out[r.id] = { total: r.total, tickets: r.tickets, invitations: r.invitations };
  }
  return out;
};

// Events enriched with per-event stats
export const fetchEventsEnriched = async (token: string): Promise<Event[]> => {
  const cacheKey = "events-enriched";
  const cached = getCached<Event[]>(cacheKey);
  if (cached) return cached;

  const flatEvents = await fetchEventList(token);
  const statsMap = await fetchFunctionStatsMap(
    token,
    flatEvents.map((e) => e.id),
  );

  const enrichedFlat = flatEvents.map((event) => {
    const s = statsMap[event.id];
    const tickets = s?.tickets ?? 0;
    const revenue = s?.total ?? 0;
    return {
      ...event,
      ticketsSold: tickets,
      grossRevenueARS: revenue,
      ticketPriceARS: tickets > 0 ? revenue / tickets : 0,
      invitations: s?.invitations ?? 0,
    };
  });

  const grouped = groupEventsByName(enrichedFlat);
  setCached(cacheKey, grouped);
  return grouped;
};

export const fetchEvents = fetchEventsEnriched;

export const fetchGlobalStats = async (token: string, date: string): Promise<StatsData> => {
  const cacheKey = `global-stats-${date}`;
  const cached = getCached<StatsData>(cacheKey);
  if (cached) return cached;
  const data = await fetchStats(token, { date });
  setCached(cacheKey, data);
  return data;
};

export const fetchEventStats = async (
  token: string,
  eventId: string,
  date: string = "all",
): Promise<StatsData> => {
  const cacheKey = `event-stats-${eventId}-${date}`;
  const cached = getCached<StatsData>(cacheKey);
  if (cached) return cached;
  const data = await fetchStats(token, { id: eventId, date });
  setCached(cacheKey, data);
  return data;
};

export const fetchSectors = async (token: string, eventId: string): Promise<Sector[]> => {
  const cacheKey = `sectors-${eventId}`;
  const cached = getCached<Sector[]>(cacheKey);
  if (cached) return cached;
  const data = await fetchOnlineSales(token, eventId);
  setCached(cacheKey, data);
  return data;
};

// ─── History (SWR: 2 min fresh, 15 min stale) ────────────────────────────────

const HISTORY_FRESH_MS = 2 * 60 * 1000;
const HISTORY_STALE_MS = 15 * 60 * 1000;

type HistoryEntry = { data: HistoryResult; freshUntil: number; staleUntil: number };
const historyCache = new Map<string, HistoryEntry>();
const historyInflight = new Map<string, Promise<HistoryResult>>();

const historyKey = (eventId: string | undefined, date: string): string =>
  `history-${eventId ?? "all"}-${date}`;

const revalidateHistory = (token: string, key: string, params: ReportParams): Promise<HistoryResult> => {
  const existing = historyInflight.get(key);
  if (existing) return existing;

  const p = fetchHistory(token, params)
    .then((data) => {
      const now = Date.now();
      historyCache.set(key, {
        data,
        freshUntil: now + HISTORY_FRESH_MS,
        staleUntil: now + HISTORY_STALE_MS,
      });
      return data;
    })
    .finally(() => historyInflight.delete(key));

  historyInflight.set(key, p);
  return p;
};

export const fetchHistoryFor = async (
  token: string,
  eventId: string | undefined,
  date: string = "all",
): Promise<HistoryResult> => {
  const key = historyKey(eventId, date);
  const params: ReportParams = { date };
  if (eventId) params.id = eventId;

  const entry = historyCache.get(key);
  const now = Date.now();

  if (entry && entry.freshUntil > now) {
    return entry.data;
  }

  if (entry && entry.staleUntil > now) {
    // Serve stale immediately, refresh in background
    revalidateHistory(token, key, params).catch(() => {});
    return entry.data;
  }

  return revalidateHistory(token, key, params);
};

// ─── Payments (no cache) ─────────────────────────────────────────────────────

export const fetchPaymentsForEvent = async (
  token: string,
  eventId: string,
  date: string = "all",
): Promise<PaymentRow[]> => {
  return fetchPayments(token, { id: eventId, date });
};
