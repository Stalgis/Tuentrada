const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARGENTINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toCalendarDate = (value) => {
  const parts = dateFormatter.formatToParts(value);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
};

const fromCalendarDate = ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day));

const formatCalendarDate = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const assertISODate = (value, fieldName) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    throw new Error(`${fieldName} debe tener formato YYYY-MM-DD.`);
  }
};

export const resolveEventDateRange = ({ periodo, fechaDesde, fechaHasta, now = new Date() }) => {
  if (!periodo || periodo === "todos") return null;

  if (periodo === "personalizado") {
    assertISODate(fechaDesde, "fechaDesde");
    assertISODate(fechaHasta, "fechaHasta");
    if (fechaDesde > fechaHasta) {
      throw new Error("fechaDesde no puede ser posterior a fechaHasta.");
    }
    return { from: fechaDesde, to: fechaHasta };
  }

  const today = fromCalendarDate(toCalendarDate(now));
  const dayOfWeek = today.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = addDays(today, mondayOffset);

  if (periodo === "hoy") {
    const date = formatCalendarDate(today);
    return { from: date, to: date };
  }

  if (periodo === "manana") {
    const date = formatCalendarDate(addDays(today, 1));
    return { from: date, to: date };
  }

  if (periodo === "esta_semana") {
    return {
      from: formatCalendarDate(thisMonday),
      to: formatCalendarDate(addDays(thisMonday, 6)),
    };
  }

  if (periodo === "semana_pasada") {
    return {
      from: formatCalendarDate(addDays(thisMonday, -7)),
      to: formatCalendarDate(addDays(thisMonday, -1)),
    };
  }

  if (periodo === "proxima_semana") {
    return {
      from: formatCalendarDate(addDays(thisMonday, 7)),
      to: formatCalendarDate(addDays(thisMonday, 13)),
    };
  }

  if (periodo === "este_mes") {
    const firstDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { from: formatCalendarDate(firstDay), to: formatCalendarDate(lastDay) };
  }

  throw new Error(`Período no soportado: ${periodo}`);
};

export const eventIsWithinRange = (event, range) => {
  if (!range) return true;
  const eventDate = event.dateISO?.slice(0, 10);
  return Boolean(eventDate && eventDate >= range.from && eventDate <= range.to);
};
