import {
  PERIOD_LABELS,
  compareEvents,
  comparePeriods,
  getEventStats,
  listEvents,
} from "./eventData.mjs";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("es-AR");

const eventNames = ["Festival Horizonte", "Noche Neón", "Sonidos del Sur"];

const namesMentionedIn = (question) => {
  const normalized = question.toLocaleLowerCase("es");
  return eventNames.filter((name) => normalized.includes(name.toLocaleLowerCase("es")));
};

const periodFrom = (question) =>
  /semana pasada/i.test(question) ? "last_week" : "this_week";

export const runMockAgent = (question, { ownerId, audit = () => {} }) => {
  const names = namesMentionedIn(question);

  if (/listar|cu[aá]les|mis eventos/i.test(question)) {
    audit("listar_eventos", {});
    const events = listEvents(ownerId);
    return `Tus eventos son: ${events.map((event) => event.name).join(", ")}.`;
  }

  if (/compar/i.test(question) && names.length >= 2) {
    const period = periodFrom(question);
    const args = { eventoA: names[0], eventoB: names[1], periodo: period };
    audit("comparar_eventos", args);
    const result = compareEvents(ownerId, names[0], names[1], period);
    return `${result.leaderByTickets} lidera en entradas ${PERIOD_LABELS[period]} por ${number.format(Math.abs(result.ticketDifference))}. En recaudación, ${result.leaderByRevenue} lidera por ${money.format(Math.abs(result.revenueDifferenceARS))}.`;
  }

  if (/semana pasada|creci|cay|variaci[oó]n/i.test(question) && names.length >= 1) {
    audit("comparar_periodos", { evento: names[0] });
    const result = comparePeriods(ownerId, names[0]);
    const direction = result.ticketChange >= 0 ? "subieron" : "bajaron";
    return `Las entradas de ${result.eventName} ${direction} ${Math.abs(result.ticketChangePercent)}%: pasaron de ${number.format(result.previous.tickets)} a ${number.format(result.current.tickets)}.`;
  }

  if (names.length >= 1) {
    const period = periodFrom(question);
    const args = { evento: names[0], periodo: period };
    audit("obtener_estadisticas", args);
    const stats = getEventStats(ownerId, names[0], period);
    return `${stats.eventName} vendió ${number.format(stats.tickets)} entradas y recaudó ${money.format(stats.revenueARS)} ${PERIOD_LABELS[period]}.`;
  }

  return "Necesito el nombre de un evento. Podés preguntarme por Festival Horizonte, Noche Neón o Sonidos del Sur.";
};
