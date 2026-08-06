import type { Event, EventFunction } from "./types";
import { currentGeneration, isCurrentGeneration } from "./session";
import { InflightRegistry } from "./InflightRegistry";
import { applyStatsToFlatEvents, type FunctionStatsValue } from "./eventStats";
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
let eventsCacheVersion = 0;

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
  eventsCacheVersion += 1;
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
          statsStatus: ev.statsStatus ?? "pending",
        }],
        statsStatus: ev.statsStatus ?? "pending",
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
      statsStatus: e.statsStatus ?? "pending",
    }));

    const ticketsSold = sorted.reduce((s, e) => s + e.ticketsSold, 0);
    const grossRevenueARS = sorted.reduce((s, e) => s + (e.grossRevenueARS ?? 0), 0);
    const statsStatus = sorted.some((e) => e.statsStatus === "error")
      ? "error"
      : sorted.every((e) => e.statsStatus === "loaded")
        ? "loaded"
        : "pending";

    return {
      ...upcoming,
      id: group[0].id,
      status: allFinished ? "finished" : anySoldOut ? "sold_out" : "on_sale",
      ticketsSold,
      ticketsAvailable: sorted.reduce((s, e) => s + e.ticketsAvailable, 0),
      grossRevenueARS,
      ticketPriceARS: ticketsSold > 0 ? grossRevenueARS / ticketsSold : 0,
      statsStatus,
      functions,
    };
  });
}

export type FunctionStats = FunctionStatsValue;
export type EventsLoadResult = { events: Event[]; failedIds: string[] };
type FunctionStatsResult = { stats: Record<string, FunctionStats>; failedIds: string[] };

// El backend solo expone stats por función (/stats?id=). Para tener recaudación
// y entradas reales por función, las pedimos en paralelo (en lotes) y cacheadas.
const fetchFunctionStatsMap = async (
  token: string,
  functionIds: string[],
  date: string = "all",
): Promise<FunctionStatsResult> => {
  const CONCURRENCY = 8;
  const out: Record<string, FunctionStats> = {};
  const failedIds: string[] = [];
  for (let i = 0; i < functionIds.length; i += CONCURRENCY) {
    const batch = functionIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((id) =>
        fetchEventStats(token, id, date)
          .then((s) => ({ id, total: s.total ?? 0, tickets: s.tickets ?? 0, invitations: s.invitations ?? 0 }))
          .catch(() => null),
      ),
    );
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (!result) {
        failedIds.push(batch[index]);
        continue;
      }
      out[result.id] = {
        total: result.total,
        tickets: result.tickets,
        invitations: result.invitations,
      };
    }
  }
  return { stats: out, failedIds };
};

// Varias pantallas piden los eventos al montarse casi a la vez. Sin deduplicar,
// cada una dispara su propio fan-out de una petición por función (cientos en
// cuentas grandes). La generación forma parte de la clave, así una petición de
// la sesión anterior nunca se comparte con la nueva.
const eventsInflight = new InflightRegistry<EventsLoadResult>();

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
): Promise<EventsLoadResult> => {
  const flatEvents = await fetchEventList(token);

  if (onPartial && isCurrentGeneration(gen)) {
    onPartial(groupEventsByName(flatEvents));
  }

  const { stats: statsMap, failedIds } = await fetchFunctionStatsMap(
    token,
    flatEvents.map((e) => e.id),
  );

  const enrichedFlat = applyStatsToFlatEvents(flatEvents, statsMap);

  const grouped = groupEventsByName(enrichedFlat);
  const result = { events: grouped, failedIds };
  setCachedForGeneration(cacheKey, result, gen);
  return result;
};

// Events enriched with per-event stats
export const fetchEventsEnriched = async (
  token: string,
  onPartial?: OnEventsPartial,
): Promise<EventsLoadResult> => {
  const gen = currentGeneration();
  // La versión separa un refresh forzado de cualquier carga anterior de la
  // misma sesión. Una promesa vieja puede terminar, pero escribe en otra clave.
  const cacheKey = scopedKey(`events-enriched-${eventsCacheVersion}`, gen);
  const cached = getCached<EventsLoadResult>(cacheKey);
  if (cached) return cached;

  // Quien se cuelgue de una carga en curso recibe solo el resultado final: el
  // parcial ya lo publicó el primer llamador.
  return eventsInflight.getOrCreate(
    cacheKey,
    () => loadEventsEnriched(token, gen, cacheKey, onPartial),
  );
};

export const retryFailedFunctionStats = async (
  token: string,
  events: Event[],
  functionIds: string[],
): Promise<EventsLoadResult> => {
  const gen = currentGeneration();
  const { stats, failedIds } = await fetchFunctionStatsMap(token, functionIds);
  const attemptedIds = new Set(functionIds);
  const failedSet = new Set(failedIds);

  const updatedEvents = events.map((event) => {
    const functions = (event.functions ?? []).map((fn) => {
      if (!attemptedIds.has(fn.id)) return fn;
      const value = stats[fn.id];
      if (!value || failedSet.has(fn.id)) {
        return { ...fn, statsStatus: "error" as const };
      }
      return {
        ...fn,
        ticketsSold: value.tickets,
        grossRevenueARS: value.total,
        invitations: value.invitations,
        statsStatus: "loaded" as const,
      };
    });

    const hasError = functions.some((fn) => fn.statsStatus === "error");
    const ticketsSold = functions.reduce((sum, fn) => sum + fn.ticketsSold, 0);
    const grossRevenueARS = functions.reduce((sum, fn) => sum + fn.grossRevenueARS, 0);
    const invitations = functions.reduce((sum, fn) => sum + fn.invitations, 0);
    return {
      ...event,
      functions,
      ticketsSold,
      grossRevenueARS,
      invitations,
      ticketPriceARS: ticketsSold > 0 ? grossRevenueARS / ticketsSold : 0,
      statsStatus: hasError ? "error" as const : "loaded" as const,
    };
  });

  const result = { events: updatedEvents, failedIds };
  const cacheKey = scopedKey(`events-enriched-${eventsCacheVersion}`, gen);
  setCachedForGeneration(cacheKey, result, gen);
  return result;
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
