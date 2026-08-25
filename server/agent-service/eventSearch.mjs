import { eventIsWithinRange } from "./eventDateRanges.mjs";

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

export const searchEventCatalog = ({ events, consulta, range, limite }) => {
  const matches = events.filter(
    (event) =>
      (!consulta || normalize(event.name).includes(normalize(consulta))) &&
      eventIsWithinRange(event, range),
  );

  return {
    totalAccessible: events.length,
    totalMatches: matches.length,
    truncated: matches.length > limite,
    events: matches.slice(0, limite),
  };
};
