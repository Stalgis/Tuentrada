import type { HistoryDay } from "./reportApi";

/** Un día del histórico, ya normalizado y listo para graficar. */
export type DailySale = {
  /** Clave `YYYY-MM-DD` en hora de Argentina. Estable entre dispositivos. */
  key: string;
  date: Date;
  sold: number;
  guests: number;
  total: number;
  net: number;
  /**
   * `false` cuando el backend no devolvió fila para esa fecha y la rellenamos
   * nosotros. No es lo mismo que un día con cero ventas: el backend manda esos
   * con ceros explícitos, y pintarlos igual borraría esa diferencia.
   */
  hasData: boolean;
};

export type HistorySummary = {
  totalSold: number;
  totalGuests: number;
  totalTickets: number;
  totalNet: number;
  daysWithData: number;
  daysInSpan: number;
  last7: number;
  prev7: number;
  /** `null` cuando la semana anterior fue cero: el porcentaje no existe. */
  deltaPct: number | null;
  bestDay: DailySale | null;
  /** Día de mayor volumen, normalmente la salida a la venta. */
  launchDay: DailySale | null;
  /** Promedio diario sin el día de salida, que de otro modo lo duplica. */
  averageExcludingLaunch: number;
  /** Recaudación sobre entradas vendidas, no sobre emitidas. */
  averageTicketPrice: number;
};

const DAY_MS = 86_400_000;

export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

/**
 * `day_date` llega como `2026-03-09T03:00:00.000000Z`: medianoche de UTC-3. Se
 * toma la porción de fecha como texto en vez de `new Date(day_date)`, porque
 * construir la fecha y leerla con `getDate()` corre el día en cualquier
 * dispositivo con huso distinto al de Argentina. `day_formatted` (DD-MM-YYYY)
 * queda como respaldo.
 */
export const parseHistoryDate = (row: HistoryDay): Date | null => {
  const iso = row.day_date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dmy = row.day_formatted?.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));

  // Incluye la fila TOTAL (`day_date: null`, `day_formatted: "TOTAL"`), que sin
  // este filtro produce un Invalid Date y una barra fantasma al final.
  return null;
};

/**
 * Convierte las filas del backend en una serie diaria continua.
 *
 * El backend omite días enteros cuando no hubo movimiento (en el histórico de
 * la función 4928 faltan 10-03, 11-03 y 01-04). Graficada tal cual, la serie
 * miente: dos fechas separadas quedan contiguas en el eje X. Se rellena el
 * tramo entre el primer y el último día con datos, marcando los rellenos.
 *
 * Si dos filas comparten fecha se suman, para tolerar que una consulta con
 * varios `ids` devuelva una fila por función y por día.
 */
export const buildDailySeries = (rows: readonly HistoryDay[]): DailySale[] => {
  const byKey = new Map<string, DailySale>();

  for (const row of rows) {
    const date = parseHistoryDate(row);
    if (!date) continue;
    const key = toDayKey(date);
    const existing = byKey.get(key);
    if (existing) {
      existing.sold += row.sold_tickets ?? 0;
      existing.guests += row.sold_guest ?? 0;
      existing.total += row.total_tickets ?? 0;
      existing.net += row.total_net ?? 0;
      continue;
    }
    byKey.set(key, {
      key,
      date,
      sold: row.sold_tickets ?? 0,
      guests: row.sold_guest ?? 0,
      total: row.total_tickets ?? 0,
      net: row.total_net ?? 0,
      hasData: true,
    });
  }

  if (byKey.size === 0) return [];

  const present = [...byKey.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const last = present[present.length - 1].date;
  const series: DailySale[] = [];

  for (
    const cursor = new Date(present[0].date);
    cursor.getTime() <= last.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = toDayKey(cursor);
    const found = byKey.get(key);
    series.push(
      found ?? {
        key,
        date: new Date(cursor),
        sold: 0,
        guests: 0,
        total: 0,
        net: 0,
        hasData: false,
      },
    );
  }

  return series;
};

/** Recorta la serie a un rango inclusivo de claves `YYYY-MM-DD`. */
export const sliceSeries = (
  series: readonly DailySale[],
  fromKey?: string,
  toKey?: string,
): DailySale[] =>
  series.filter(
    (day) => (!fromKey || day.key >= fromKey) && (!toKey || day.key <= toKey),
  );

/** Acumulado corrido de entradas y recaudación, en el orden de la serie. */
export const cumulative = (
  series: readonly DailySale[],
): { tickets: number[]; net: number[] } => {
  const tickets: number[] = [];
  const net: number[] = [];
  let t = 0;
  let n = 0;
  for (const day of series) {
    t += day.total;
    n += day.net;
    tickets.push(t);
    net.push(n);
  }
  return { tickets, net };
};

/**
 * Cortes en los percentiles 20/40/60/80 de los valores recibidos.
 *
 * Una escala lineal no sirve acá: el día de salida a la venta multiplica por
 * sesenta a la mediana, así que deja al resto del período en el primer 2 % de
 * la rampa, todos del mismo color. Con cuantiles siempre hay contraste, y el
 * color pasa a decir «este día estuvo entre los mejores del rango» en vez de
 * «este día fue bueno o malo», que exigiría una meta que el backend no da.
 */
export const quantileCuts = (values: readonly number[]): number[] => {
  if (values.length === 0) return [0, 0, 0, 0];
  const sorted = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map(
    (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))],
  );
};

/** Devuelve 1..5 según en qué tramo de `cuts` cae el valor. */
export const bucketFor = (value: number, cuts: readonly number[]): number => {
  for (let i = 0; i < cuts.length; i += 1) {
    if (value <= cuts[i]) return i + 1;
  }
  return cuts.length + 1;
};

/**
 * Techo para la escala de las barras diarias. Sin recortar, el día de salida a
 * la venta deja al resto de las barras en un pixel.
 *
 * No es un percentil puro: el índice se limita a `length - 2` para que el
 * máximo siempre quede por encima del corte. Con pocos días un percentil alto
 * cae justo sobre el máximo y el recorte no haría nada, que es exactamente el
 * caso que esto viene a evitar.
 */
export const barScaleCutoff = (values: readonly number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const index = Math.min(Math.floor(p * sorted.length), sorted.length - 2);
  return sorted[Math.max(0, index)];
};

const sumTotals = (days: readonly DailySale[]): number =>
  days.reduce((acc, day) => acc + day.total, 0);

export const summarizeHistory = (series: readonly DailySale[]): HistorySummary => {
  const withData = series.filter((day) => day.hasData);
  const totalSold = withData.reduce((acc, day) => acc + day.sold, 0);
  const totalNet = withData.reduce((acc, day) => acc + day.net, 0);

  const last7 = sumTotals(series.slice(-7));
  const prev7 = sumTotals(series.slice(-14, -7));

  const launchDay =
    withData.length > 0
      ? withData.reduce((best, day) => (day.total > best.total ? day : best))
      : null;
  const bestDay =
    withData.length > 0
      ? withData.reduce((best, day) => (day.net > best.net ? day : best))
      : null;

  const rest = launchDay ? withData.filter((day) => day !== launchDay) : withData;

  return {
    totalSold,
    totalGuests: withData.reduce((acc, day) => acc + day.guests, 0),
    totalTickets: withData.reduce((acc, day) => acc + day.total, 0),
    totalNet,
    daysWithData: withData.length,
    daysInSpan: series.length,
    last7,
    prev7,
    // Con la semana anterior en cero el porcentaje sería infinito: la UI muestra
    // el valor absoluto en vez de un delta inventado.
    deltaPct: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null,
    bestDay,
    launchDay,
    averageExcludingLaunch:
      rest.length > 0 ? Math.round(sumTotals(rest) / rest.length) : 0,
    // `total_net` sólo cuenta lo vendido: las invitaciones no facturan. Dividir
    // por entradas emitidas da un precio promedio falso.
    averageTicketPrice: totalSold > 0 ? totalNet / totalSold : 0,
  };
};

/**
 * Techo del eje Y de la curva acumulada, y si corresponde dibujar la línea de
 * aforo.
 *
 * El aforo sólo entra en la escala cuando la venta ya llegó a una fracción
 * razonable de él. Con 72 localidades vendidas sobre 3.282, un techo en el
 * aforo aplasta la curva contra el eje: el gráfico queda en una línea recta y
 * deja de mostrar lo único que aporta, la forma de la venta. El porcentaje de
 * aforo ya está escrito en la tarjeta de arriba, así que no se pierde el dato.
 */
export const MIN_CAPACITY_SHARE = 0.25;

export const cumulativeCeiling = (
  lastValue: number,
  capacity?: number,
): { ceiling: number; showCapacity: boolean } => {
  const showCapacity =
    capacity != null && capacity > 0 && lastValue >= capacity * MIN_CAPACITY_SHARE;
  return {
    ceiling: Math.max(showCapacity ? (capacity as number) : 0, lastValue, 1),
    showCapacity,
  };
};

/** Los N días de mayor recaudación, de mayor a menor. */
export const topDays = (series: readonly DailySale[], count: number): DailySale[] =>
  series
    .filter((day) => day.hasData)
    .slice()
    .sort((a, b) => b.net - a.net)
    .slice(0, count);

/** Clave del día que está `days` días antes del último de la serie. */
export const keyDaysBefore = (series: readonly DailySale[], days: number): string | undefined => {
  if (series.length === 0) return undefined;
  const last = series[series.length - 1].date;
  return toDayKey(new Date(last.getTime() - (days - 1) * DAY_MS));
};
