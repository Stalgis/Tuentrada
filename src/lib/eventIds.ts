import type { Event } from "./types";

export const uniqueIds = (ids: readonly string[]): string[] => [...new Set(ids)];

export const getEventFunctionIds = (event: Event): string[] => {
  const functionIds = event.functions?.map((fn) => fn.id) ?? [];
  return uniqueIds(functionIds.length > 0 ? functionIds : [event.id]);
};

export const getEventsFunctionIds = (events: readonly Event[]): string[] =>
  uniqueIds(events.flatMap(getEventFunctionIds));

export const getFunctionIdsForSelection = (
  events: readonly Event[],
  selectedEventId: string,
): string[] => {
  if (selectedEventId === "all") return getEventsFunctionIds(events);
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  return selectedEvent ? getEventFunctionIds(selectedEvent) : [];
};

export const getIdsKey = (ids: readonly string[]): string =>
  uniqueIds(ids).sort().join(",");
