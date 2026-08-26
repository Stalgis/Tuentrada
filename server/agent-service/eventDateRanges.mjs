import { ToolInputError } from "./toolErrors.mjs";

const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Períodos que la tool sabe resolver. Es la única fuente: el enum del schema
 * que ve el modelo se construye a partir de esta lista.
 *
 * Cada período que vive acá es un caso que NO cae en `personalizado`, donde el
 * modelo tiene que inventar fechas. Ampliar esta lista es más seguro que
 * confiar en que complete bien YYYY-MM-DD.
 */
export const PERIODOS = Object.freeze([
  "todos",
  "hoy",
  "manana",
  "proximos",
  "esta_semana",
  "semana_pasada",
  "proxima_semana",
  "este_mes",
  "mes_pasado",
  "proximo_mes",
  "personalizado",
]);

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARGENTINA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ARGENTINA_TIME_ZONE,
  weekday: "long",
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

const monthRange = (reference, monthOffset) => {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth() + monthOffset;
  return {
    from: formatCalendarDate(new Date(Date.UTC(year, month, 1))),
    to: formatCalendarDate(new Date(Date.UTC(year, month + 1, 0))),
  };
};

const assertISODate = (value, fieldName) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    throw new ToolInputError(`${fieldName} debe tener formato YYYY-MM-DD.`);
  }
};

/** Fecha de hoy en Argentina como YYYY-MM-DD. */
export const todayInArgentina = (now = new Date()) =>
  formatCalendarDate(fromCalendarDate(toCalendarDate(now)));

/** Día de la semana en Argentina, en español. */
export const weekdayInArgentina = (now = new Date()) =>
  weekdayFormatter.format(now);

/**
 * Devuelve `null` (sin filtro) o `{ from, to }` en formato YYYY-MM-DD.
 * `to` puede ser `null`: significa rango abierto hacia el futuro.
 */
export const resolveEventDateRange = ({ periodo, fechaDesde, fechaHasta, now = new Date() }) => {
  if (!periodo || periodo === "todos") return null;

  if (periodo === "personalizado") {
    assertISODate(fechaDesde, "fechaDesde");
    assertISODate(fechaHasta, "fechaHasta");
    if (fechaDesde > fechaHasta) {
      throw new ToolInputError("fechaDesde no puede ser posterior a fechaHasta.");
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

  // Rango abierto: desde hoy en adelante, sin techo.
  if (periodo === "proximos") {
    return { from: formatCalendarDate(today), to: null };
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

  if (periodo === "este_mes") return monthRange(today, 0);
  if (periodo === "mes_pasado") return monthRange(today, -1);
  if (periodo === "proximo_mes") return monthRange(today, 1);

  throw new ToolInputError(`Período no soportado: ${periodo}`);
};

/**
 * `event.fecha` es YYYY-MM-DD o "" cuando el backend no mandó fecha usable.
 * Un evento sin fecha nunca entra en un rango: no se puede afirmar que
 * pertenezca al período. `searchEventCatalog` los cuenta aparte para que el
 * modelo pueda decirlo en vez de omitirlos en silencio.
 */
export const eventIsWithinRange = (event, range) => {
  if (!range) return true;
  const fecha = event.fecha;
  if (!fecha) return false;
  if (fecha < range.from) return false;
  if (range.to && fecha > range.to) return false;
  return true;
};
