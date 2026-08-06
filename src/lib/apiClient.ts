import type { Event, EventFunction } from "./types";
import { currentGeneration, isCurrentGeneration } from "./session";
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

/**
 * Prefija la clave con la generación de sesión, de modo que las entradas de dos
 * sesiones nunca puedan colisionar aunque falle una limpieza.
 */
const scopedKey = (key: string, gen: number): string => `${gen}::${key}`;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}

/** Solo escribe si la generación capturada sigue vigente. */
function setCachedForGeneration<T>(
  key: string,
  data: T,
  gen: number,
  ttlMs: number = CACHE_TTL_MS,
): void {
  if (!isCurrentGeneration(gen)) return;
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Limpia todas las estructuras de caché y peticiones en vuelo (no solo `cache`). */
export const clearAllCaches = (): void => {
  cache.clear();
  eventsInflight.clear();
  historyCache.clear();
  historyInflight.clear();
};

export const invalidateEventsCache = (): void => clearAllCaches();

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

// Varias pantallas piden los eventos al montarse casi a la vez. Sin deduplicar,
// cada una dispara su propio fan-out de una petición por función (cientos en
// cuentas grandes). La generación forma parte de la clave, así una petición de
// la sesión anterior nunca se comparte con la nueva.
const eventsInflight = new Map<string, Promise<Event[]>>();

/**
 * Se invoca con los eventos ya listables (nombre, fecha y estado) apenas llega
 * el catálogo, antes de que existan los importes. Permite pintar la pantalla en
 * ~1s en vez de esperar una petición de stats por función.
 */
export type OnEventsPartial = (events: Event[]) => void;

const loadEventsEnriched = async (
  token: string,
  gen: number,
  cacheKey: string,
  onPartial?: OnEventsPartial,
): Promise<Event[]> => {
  const flatEvents = await fetchEventList(token);

  if (onPartial && isCurrentGeneration(gen)) {
    onPartial(groupEventsByName(flatEvents));
  }

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
  setCachedForGeneration(cacheKey, grouped, gen);
  return grouped;
};

// Events enriched with per-event stats
export const fetchEventsEnriched = async (
  token: string,
  onPartial?: OnEventsPartial,
): Promise<Event[]> => {
  const gen = currentGeneration();
  const cacheKey = scopedKey("events-enriched", gen);
  const cached = getCached<Event[]>(cacheKey);
  if (cached) return cached;

  // Quien se cuelgue de una carga en curso recibe solo el resultado final: el
  // parcial ya lo publicó el primer llamador.
  const existing = eventsInflight.get(cacheKey);
  if (existing) return existing;

  const p = loadEventsEnriched(token, gen, cacheKey, onPartial).finally(() =>
    eventsInflight.delete(cacheKey),
  );

  eventsInflight.set(cacheKey, p);
  return p;
};

export const fetchEvents = fetchEventsEnriched;

export const fetchGlobalStats = async (token: string, date: string): Promise<StatsData> => {
  const gen = currentGeneration();
  const cacheKey = scopedKey(`global-stats-${date}`, gen);
  const cached = getCached<StatsData>(cacheKey);
  if (cached) return cached;
  const data = await fetchStats(token, { date });
  setCachedForGeneration(cacheKey, data, gen);
  return data;
};

export const fetchEventStats = async (
  token: string,
  eventId: string,
  date: string = "all",
): Promise<StatsData> => {
  const gen = currentGeneration();
  const cacheKey = scopedKey(`event-stats-${eventId}-${date}`, gen);
  const cached = getCached<StatsData>(cacheKey);
  if (cached) return cached;
  const data = await fetchStats(token, { id: eventId, date });
  setCachedForGeneration(cacheKey, data, gen);
  return data;
};

export const fetchSectors = async (token: string, eventId: string): Promise<Sector[]> => {
  const gen = currentGeneration();
  const cacheKey = scopedKey(`sectors-${eventId}`, gen);
  const cached = getCached<Sector[]>(cacheKey);
  if (cached) return cached;
  const data = await fetchOnlineSales(token, eventId);
  setCachedForGeneration(cacheKey, data, gen);
  return data;
};

// ─── History (SWR: 2 min fresh, 15 min stale) ────────────────────────────────

const HISTORY_FRESH_MS = 2 * 60 * 1000;
const HISTORY_STALE_MS = 15 * 60 * 1000;

type HistoryEntry = { data: HistoryResult; freshUntil: number; staleUntil: number };
const historyCache = new Map<string, HistoryEntry>();
const historyInflight = new Map<string, Promise<HistoryResult>>();

// La generación forma parte de la clave: así el `finally` de una petición vieja
// no puede borrar la entrada en vuelo de la sesión nueva.
const historyKey = (eventId: string | undefined, date: string, gen: number): string =>
  scopedKey(`history-${eventId ?? "all"}-${date}`, gen);

const revalidateHistory = (
  token: string,
  key: string,
  params: ReportParams,
  gen: number,
): Promise<HistoryResult> => {
  const existing = historyInflight.get(key);
  if (existing) return existing;

  const p = fetchHistory(token, params)
    .then((data) => {
      if (!isCurrentGeneration(gen)) return data; // respuesta de una sesión anterior
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
  const gen = currentGeneration();
  const key = historyKey(eventId, date, gen);
  const params: ReportParams = { date };
  if (eventId) params.id = eventId;

  const entry = historyCache.get(key);
  const now = Date.now();

  if (entry && entry.freshUntil > now) {
    return entry.data;
  }

  if (entry && entry.staleUntil > now) {
    // Serve stale immediately, refresh in background
    revalidateHistory(token, key, params, gen).catch(() => {});
    return entry.data;
  }

  return revalidateHistory(token, key, params, gen);
};

// ─── Payments (no cache) ─────────────────────────────────────────────────────

export const fetchPaymentsForEvent = async (
  token: string,
  eventId: string,
  date: string = "all",
): Promise<PaymentRow[]> => {
  return fetchPayments(token, { id: eventId, date });
};
