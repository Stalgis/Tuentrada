import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  bucketFor,
  buildDailySeries,
  cumulative,
  keyDaysBefore,
  parseHistoryDate,
  barScaleCutoff,
  quantileCuts,
  sliceSeries,
  summarizeHistory,
  toDayKey,
  topDays,
} from "../src/lib/salesHistory.ts";

const day = (dmy, sold = 0, guest = 0, net = 0) => {
  const [d, m, y] = dmy.split("-");
  return {
    day_date: `${y}-${m}-${d}T03:00:00.000000Z`,
    day_formatted: dmy,
    sold_tickets: sold,
    sold_guest: guest,
    total_tickets: sold + guest,
    total_net: net,
  };
};

test("descarta la fila TOTAL en vez de graficarla como un día", () => {
  const total = {
    day_date: null,
    day_formatted: "TOTAL",
    sold_tickets: 1736,
    sold_guest: 226,
    total_tickets: 1962,
    total_net: 123675000,
  };
  assert.equal(parseHistoryDate(total), null);

  const series = buildDailySeries([day("09-03-2026", 1, 0, 70000), total]);
  assert.equal(series.length, 1);
  assert.equal(series[0].key, "2026-03-09");
});

test("parsea el día sin depender del huso del dispositivo", () => {
  // day_date llega como medianoche de UTC-3. Leerlo con `new Date()` y
  // getDate() corre la venta un día en husos al este de Argentina.
  const script =
    'import { buildDailySeries } from "./src/lib/salesHistory.ts";' +
    'const r = buildDailySeries([{ day_date: "2026-03-09T03:00:00.000000Z",' +
    ' day_formatted: "09-03-2026", sold_tickets: 1, sold_guest: 0,' +
    ' total_tickets: 1, total_net: 70000 }]);' +
    "process.stdout.write(r[0].key);";

  for (const TZ of ["UTC", "Pacific/Auckland", "America/Argentina/Buenos_Aires"]) {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, TZ },
      encoding: "utf8",
    });
    assert.equal(out, "2026-03-09", `huso ${TZ}`);
  }
});

test("usa day_formatted cuando no viene day_date", () => {
  const parsed = parseHistoryDate({
    day_date: "",
    day_formatted: "01-04-2026",
    sold_tickets: 0,
    sold_guest: 0,
    total_tickets: 0,
    total_net: 0,
  });
  assert.equal(toDayKey(parsed), "2026-04-01");
});

test("rellena los días que el backend omite y los distingue de un cero real", () => {
  // Caso real de la función 4928: falta el 01-04, pero el 09-03 viene con cero.
  const series = buildDailySeries([
    day("31-03-2026", 6, 0, 430000),
    day("02-04-2026", 3, 0, 210000),
    day("03-04-2026", 4, 0, 300000),
  ]);

  assert.deepEqual(
    series.map((d) => d.key),
    ["2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03"],
  );
  assert.equal(series[1].hasData, false);
  assert.equal(series[1].total, 0);

  const conCero = buildDailySeries([day("09-03-2026", 0, 0, 0), day("10-03-2026", 5, 0, 300000)]);
  assert.equal(conCero[0].hasData, true, "un cero explícito no es un hueco");
});

test("suma filas que comparten fecha", () => {
  // Tolera que una consulta con varios ids devuelva una fila por función.
  const series = buildDailySeries([day("12-03-2026", 100, 0, 7000000), day("12-03-2026", 11, 5, 700000)]);
  assert.equal(series.length, 1);
  assert.equal(series[0].sold, 111);
  assert.equal(series[0].guests, 5);
  assert.equal(series[0].net, 7700000);
});

test("serie vacía no explota", () => {
  assert.deepEqual(buildDailySeries([]), []);
  const empty = summarizeHistory([]);
  assert.equal(empty.bestDay, null);
  assert.equal(empty.averageExcludingLaunch, 0);
  assert.equal(empty.averageTicketPrice, 0);
});

test("el acumulado corre sobre entradas y recaudación", () => {
  const series = buildDailySeries([
    day("12-03-2026", 511, 0, 40505000),
    day("13-03-2026", 7, 0, 525000),
  ]);
  const { tickets, net } = cumulative(series);
  assert.deepEqual(tickets, [511, 518]);
  assert.deepEqual(net, [40505000, 41030000]);
});

test("los cuantiles reparten el rango aunque haya un outlier", () => {
  const values = [0, 60000, 70000, 140000, 235000, 290000, 690000, 1715000, 40505000];
  const cuts = quantileCuts(values);
  assert.equal(cuts.length, 4);
  for (let i = 1; i < cuts.length; i += 1) {
    assert.ok(cuts[i] >= cuts[i - 1], "los cortes no pueden bajar");
  }
  // El outlier cae en el tramo más alto y el mínimo en el más bajo.
  assert.equal(bucketFor(40505000, cuts), 5);
  assert.equal(bucketFor(0, cuts), 1);
  // Un día mediano no queda en el mismo tramo que el máximo, que es justo lo
  // que sí pasaría con una escala lineal.
  assert.notEqual(bucketFor(290000, cuts), bucketFor(40505000, cuts));
});

test("el techo de escala siempre deja el máximo por encima", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 511];
  assert.ok(barScaleCutoff(values, 0.95) < 511, "el outlier queda por encima del corte");

  // Caso real: 51 días, con 511 y 280 muy por encima del resto.
  const reales = [0, 1, 1, 2, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 8, 8,
    10, 10, 10, 10, 13, 13, 13, 14, 14, 14, 17, 18, 20, 20, 23, 25, 30, 31, 38, 58, 61,
    65, 71, 79, 110, 138, 154, 280, 511];
  const cut = barScaleCutoff(reales, 0.95);
  assert.ok(cut < 280 && cut >= 100, `corte inesperado: ${cut}`);

  // Con un solo día no hay nada que recortar.
  assert.equal(barScaleCutoff([42], 0.95), 42);
  assert.equal(barScaleCutoff([], 0.95), 0);
});

test("el resumen separa vendidas de invitaciones", () => {
  // 22-04 real: 18 vendidas + 40 invitaciones, $1.290.000. Las invitaciones no
  // facturan, así que el precio promedio va sobre vendidas.
  const series = buildDailySeries([day("22-04-2026", 18, 40, 1290000)]);
  const s = summarizeHistory(series);
  assert.equal(s.totalSold, 18);
  assert.equal(s.totalGuests, 40);
  assert.equal(s.totalTickets, 58);
  assert.equal(Math.round(s.averageTicketPrice), 71667);
});

test("el delta es null cuando la semana anterior fue cero", () => {
  const series = buildDailySeries(
    Array.from({ length: 14 }, (_, i) =>
      day(`${String(i + 1).padStart(2, "0")}-04-2026`, i < 7 ? 0 : 10, 0, i < 7 ? 0 : 700000),
    ),
  );
  const s = summarizeHistory(series);
  assert.equal(s.prev7, 0);
  assert.equal(s.deltaPct, null, "no se inventa un porcentaje sobre cero");
});

test("el promedio diario excluye el día de salida a la venta", () => {
  const series = buildDailySeries([
    day("12-03-2026", 511, 0, 40505000),
    day("13-03-2026", 10, 0, 700000),
    day("14-03-2026", 10, 0, 700000),
  ]);
  const s = summarizeHistory(series);
  assert.equal(s.launchDay.key, "2026-03-12");
  assert.equal(s.averageExcludingLaunch, 10, "con la salida incluida daría 177");
});

test("cobertura: días con datos sobre días del tramo", () => {
  const series = buildDailySeries([day("31-03-2026", 6, 0, 430000), day("02-04-2026", 3, 0, 210000)]);
  const s = summarizeHistory(series);
  assert.equal(s.daysInSpan, 3);
  assert.equal(s.daysWithData, 2);
});

test("top de días ordena por recaudación e ignora los huecos", () => {
  const series = buildDailySeries([
    day("12-03-2026", 511, 0, 40505000),
    day("14-03-2026", 4, 0, 260000),
    day("15-03-2026", 5, 0, 345000),
  ]);
  const top = topDays(series, 2);
  assert.deepEqual(top.map((d) => d.key), ["2026-03-12", "2026-03-15"]);
  assert.ok(top.every((d) => d.hasData));
});

test("el recorte por rango usa claves comparables como texto", () => {
  const series = buildDailySeries([
    day("31-03-2026", 6, 0, 430000),
    day("02-04-2026", 3, 0, 210000),
    day("03-04-2026", 4, 0, 300000),
  ]);
  assert.equal(keyDaysBefore(series, 2), "2026-04-02");
  const cut = sliceSeries(series, "2026-04-02");
  assert.deepEqual(cut.map((d) => d.key), ["2026-04-02", "2026-04-03"]);
});
