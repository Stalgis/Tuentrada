const EVENTS = [
  {
    id: "horizonte",
    ownerId: "demo-user",
    name: "Festival Horizonte",
    stats: {
      this_week: { tickets: 1240, revenueARS: 37_200_000 },
      last_week: { tickets: 980, revenueARS: 28_420_000 },
    },
  },
  {
    id: "neon",
    ownerId: "demo-user",
    name: "Noche Neón",
    stats: {
      this_week: { tickets: 760, revenueARS: 19_760_000 },
      last_week: { tickets: 810, revenueARS: 20_250_000 },
    },
  },
  {
    id: "sur",
    ownerId: "demo-user",
    name: "Sonidos del Sur",
    stats: {
      this_week: { tickets: 430, revenueARS: 9_890_000 },
      last_week: { tickets: 350, revenueARS: 7_700_000 },
    },
  },
  {
    id: "privado",
    ownerId: "another-user",
    name: "Evento de otro productor",
    stats: {
      this_week: { tickets: 9_999, revenueARS: 999_999_999 },
      last_week: { tickets: 9_000, revenueARS: 900_000_000 },
    },
  },
];

export const PERIOD_LABELS = {
  this_week: "esta semana",
  last_week: "la semana pasada",
};

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");

const eventsFor = (ownerId) => EVENTS.filter((event) => event.ownerId === ownerId);

const findOwnedEvent = (ownerId, eventName) => {
  const wanted = normalize(eventName);
  const event = eventsFor(ownerId).find((candidate) => {
    const name = normalize(candidate.name);
    return name === wanted || name.includes(wanted) || wanted.includes(name);
  });

  if (!event) {
    throw new Error(`No existe un evento accesible llamado "${eventName}".`);
  }

  return event;
};

const assertPeriod = (period) => {
  if (!(period in PERIOD_LABELS)) {
    throw new Error(`Período no soportado: ${period}`);
  }
};

export const listEvents = (ownerId) =>
  eventsFor(ownerId).map(({ id, name }) => ({ id, name }));

export const getEventStats = (ownerId, eventName, period) => {
  assertPeriod(period);
  const event = findOwnedEvent(ownerId, eventName);
  return {
    eventId: event.id,
    eventName: event.name,
    period,
    ...event.stats[period],
  };
};

const percentageChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

export const compareEvents = (ownerId, eventA, eventB, period) => {
  const first = getEventStats(ownerId, eventA, period);
  const second = getEventStats(ownerId, eventB, period);
  return {
    period,
    first,
    second,
    ticketDifference: first.tickets - second.tickets,
    revenueDifferenceARS: first.revenueARS - second.revenueARS,
    ticketDifferencePercent: percentageChange(first.tickets, second.tickets),
    leaderByTickets: first.tickets >= second.tickets ? first.eventName : second.eventName,
    leaderByRevenue:
      first.revenueARS >= second.revenueARS ? first.eventName : second.eventName,
  };
};

export const comparePeriods = (ownerId, eventName) => {
  const current = getEventStats(ownerId, eventName, "this_week");
  const previous = getEventStats(ownerId, eventName, "last_week");
  return {
    eventName: current.eventName,
    current,
    previous,
    ticketChange: current.tickets - previous.tickets,
    revenueChangeARS: current.revenueARS - previous.revenueARS,
    ticketChangePercent: percentageChange(current.tickets, previous.tickets),
    revenueChangePercent: percentageChange(current.revenueARS, previous.revenueARS),
  };
};
