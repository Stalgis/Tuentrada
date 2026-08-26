import { todayInArgentina } from "./eventDateRanges.mjs";
import { ToolInputError } from "./toolErrors.mjs";

/**
 * Eje temporal de VENTA: cuándo se compró la entrada.
 *
 * Es un eje distinto del de `eventDateRanges`, que filtra cuándo OCURRE el
 * evento. Las preguntas los mezclan todo el tiempo:
 *
 *   "¿cuánto vendí este mes?"                -> todos los eventos, ventas de este mes
 *   "¿cuánto vendí de los eventos de este mes?" -> eventos de este mes, ventas de todo
 *
 * Por eso los nombres son deliberadamente distintos (`periodoDeVenta` contra
 * `periodo`, `todo` contra `todos`) y este enum no tiene `manana` ni
 * `proximos`: una venta futura no existe. La asimetría es la que evita que el
 * modelo use uno creyendo que usa el otro.
 */
export const PERIODOS_DE_VENTA = Object.freeze([
  "todo",
  "hoy",
  "ayer",
  "esta_semana",
  "semana_pasada",
  "este_mes",
  "mes_pasado",
  "personalizado",
]);

/**
 * Períodos que el backend resuelve por su cuenta.
 *
 * Se usan sus presets en vez de calcular las fechas acá aunque ya tengamos el
 * calendario: así el número que dice el agente es el mismo que muestra el
 * dashboard. Si definiéramos "esta semana" por nuestra cuenta y el backend la
 * cortara distinto, el agente y la app dirían cifras diferentes para la misma
 * pregunta, que es la forma más rápida de perder la confianza del usuario.
 *
 * El precio de esa decisión: no sabemos los bordes exactos del preset, así que
 * la etiqueta que ve el modelo es cualitativa y nunca afirma fechas.
 */
const PRESETS = {
  todo: { date: "all", etiqueta: "todo el histórico" },
  esta_semana: { date: "this_week", etiqueta: "esta semana" },
  semana_pasada: { date: "last_week", etiqueta: "la semana pasada" },
  este_mes: { date: "this_month", etiqueta: "este mes" },
  mes_pasado: { date: "last_month", etiqueta: "el mes pasado" },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const assertISODate = (value, fieldName) => {
  if (!ISO_DATE.test(value ?? "")) {
    throw new ToolInputError(`${fieldName} debe tener formato YYYY-MM-DD.`);
  }
};

const diaAnterior = (fecha) => {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return date.toISOString().slice(0, 10);
};

const rangoExacto = (from, to, etiqueta) => ({
  date: "custom",
  dateFrom: from,
  dateTo: to,
  etiqueta,
});

/**
 * Devuelve los parámetros que entiende el backend más una etiqueta en castellano
 * para que el agente pueda decir siempre de qué período está hablando.
 */
export const resolveSalesPeriod = ({
  periodoDeVenta,
  ventasDesde,
  ventasHasta,
  now = new Date(),
}) => {
  const periodo = periodoDeVenta ?? "todo";

  const preset = PRESETS[periodo];
  if (preset) return { ...preset };

  // El backend no tiene presets de día, así que estos se arman como rango
  // exacto. La fecha sale del calendario argentino, no del reloj del servidor.
  if (periodo === "hoy") {
    const hoy = todayInArgentina(now);
    return rangoExacto(hoy, hoy, `hoy (${hoy})`);
  }

  if (periodo === "ayer") {
    const ayer = diaAnterior(todayInArgentina(now));
    return rangoExacto(ayer, ayer, `ayer (${ayer})`);
  }

  if (periodo === "personalizado") {
    assertISODate(ventasDesde, "ventasDesde");
    assertISODate(ventasHasta, "ventasHasta");
    if (ventasDesde > ventasHasta) {
      throw new ToolInputError("ventasDesde no puede ser posterior a ventasHasta.");
    }
    return rangoExacto(ventasDesde, ventasHasta, `del ${ventasDesde} al ${ventasHasta}`);
  }

  throw new ToolInputError(`Período de venta no soportado: ${periodo}`);
};
