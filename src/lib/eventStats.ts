import type { Event } from "./types";

export type FunctionStatsValue = { total: number; tickets: number; invitations: number };

export const applyStatsToFlatEvents = (
  events: Event[],
  stats: Record<string, FunctionStatsValue>,
): Event[] =>
  events.map((event) => {
    const value = stats[event.id];
    if (!value) {
      return { ...event, statsStatus: "error" as const };
    }
    return {
      ...event,
      ticketsSold: value.tickets,
      grossRevenueARS: value.total,
      ticketPriceARS: value.tickets > 0 ? value.total / value.tickets : 0,
      invitations: value.invitations,
      statsStatus: "loaded" as const,
    };
  });

export const applyStatsProgressToFlatEvents = (
  events: Event[],
  stats: Record<string, FunctionStatsValue>,
  failedIds: readonly string[],
): Event[] => {
  const failed = new Set(failedIds);
  return events.map((event) => {
    const value = stats[event.id];
    if (value) {
      return {
        ...event,
        ticketsSold: value.tickets,
        grossRevenueARS: value.total,
        ticketPriceARS: value.tickets > 0 ? value.total / value.tickets : 0,
        invitations: value.invitations,
        statsStatus: "loaded" as const,
      };
    }
    return failed.has(event.id)
      ? { ...event, statsStatus: "error" as const }
      : event;
  });
};
