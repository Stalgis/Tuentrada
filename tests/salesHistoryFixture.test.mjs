import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailySeries,
  quantileCuts,
  bucketFor,
  summarizeHistory,
  topDays,
} from "../src/lib/salesHistory.ts";

// Respuesta real de POST /api/v2/report/history?date=all con body {"ids":[4928]},
// incluida la fila TOTAL tal como la manda el backend. Sirve de checksum: los
// totales que calcula el cliente tienen que coincidir con los que ya vienen.
const RAW = [
  ["09-03", 0, 0, 0], ["12-03", 511, 0, 40505000], ["13-03", 7, 0, 525000],
  ["14-03", 4, 0, 260000], ["15-03", 5, 0, 345000], ["16-03", 5, 0, 310000],
  ["17-03", 5, 0, 425000], ["18-03", 4, 0, 320000], ["19-03", 6, 0, 435000],
  ["20-03", 7, 0, 515000], ["21-03", 1, 0, 70000], ["22-03", 10, 0, 690000],
  ["23-03", 4, 0, 290000], ["24-03", 4, 0, 320000], ["25-03", 1, 0, 60000],
  ["26-03", 2, 0, 140000], ["27-03", 23, 0, 1715000], ["28-03", 3, 0, 235000],
  ["29-03", 8, 0, 570000], ["30-03", 4, 0, 280000], ["31-03", 6, 0, 430000],
  ["02-04", 3, 0, 210000], ["03-04", 4, 0, 300000], ["04-04", 5, 0, 330000],
  ["05-04", 6, 0, 490000], ["06-04", 10, 0, 660000], ["07-04", 10, 0, 825000],
  ["08-04", 110, 0, 7640000], ["09-04", 14, 0, 1060000], ["10-04", 17, 0, 1180000],
  ["11-04", 13, 0, 890000], ["12-04", 18, 0, 1235000], ["13-04", 13, 0, 770000],
  ["14-04", 14, 0, 900000], ["15-04", 14, 0, 1025000], ["16-04", 20, 0, 1480000],
  ["17-04", 25, 0, 1730000], ["18-04", 8, 0, 540000], ["19-04", 13, 0, 935000],
  ["20-04", 20, 0, 1445000], ["21-04", 31, 0, 2125000], ["22-04", 18, 40, 1290000],
  ["23-04", 38, 0, 2640000], ["24-04", 29, 50, 2080000], ["25-04", 65, 0, 4430000],
  ["26-04", 30, 0, 1950000], ["27-04", 61, 0, 4295000], ["28-04", 69, 2, 4920000],
  ["29-04", 64, 74, 4335000], ["30-04", 134, 20, 8650000], ["01-05", 240, 40, 14875000],
];

const TOTAL_ROW = {
  day_date: null,
  day_formatted: "TOTAL",
  sold_tickets: 1736,
  sold_guest: 226,
  total_tickets: 1962,
  total_net: 123675000,
};

const payload = [
  ...RAW.map(([dm, sold, guest, net]) => {
    const [d, m] = dm.split("-");
    return {
      day_date: `2026-${m}-${d}T03:00:00.000000Z`,
      day_formatted: `${d}-${m}-2026`,
      sold_tickets: sold,
      sold_guest: guest,
      total_tickets: sold + guest,
      total_net: net,
    };
  }),
  TOTAL_ROW,
];

test("el payload real cuadra con la fila TOTAL del backend", () => {
  const series = buildDailySeries(payload);
  const summary = summarizeHistory(series);

  assert.equal(summary.totalSold, TOTAL_ROW.sold_tickets);
  assert.equal(summary.totalGuests, TOTAL_ROW.sold_guest);
  assert.equal(summary.totalTickets, TOTAL_ROW.total_tickets);
  assert.equal(summary.totalNet, TOTAL_ROW.total_net);
});

test("el payload real tiene 51 días con datos y 3 fechas ausentes", () => {
  const series = buildDailySeries(payload);
  assert.equal(series.length, 54, "09-03 a 01-05 inclusive");
  assert.equal(series.filter((d) => d.hasData).length, 51);
  assert.deepEqual(
    series.filter((d) => !d.hasData).map((d) => d.key),
    ["2026-03-10", "2026-03-11", "2026-04-01"],
  );
});

test("la escala por cuantiles separa un día mediano del día de salida", () => {
  const series = buildDailySeries(payload);
  const conDatos = series.filter((d) => d.hasData);
  const cuts = quantileCuts(conDatos.map((d) => d.net));

  const salida = conDatos.find((d) => d.key === "2026-03-12");
  const mediano = conDatos.find((d) => d.key === "2026-03-23"); // $290.000

  assert.equal(bucketFor(salida.net, cuts), 5);
  assert.ok(bucketFor(mediano.net, cuts) <= 2, "un día flojo no puede caer arriba");

  // Con escala lineal ambos caerían en el mismo tramo visual: el día mediano
  // representa el 0,7 % del máximo. Ese es el motivo de usar cuantiles.
  assert.ok(mediano.net / salida.net < 0.01);
});

test("el día de salida no distorsiona el promedio diario", () => {
  const series = buildDailySeries(payload);
  const summary = summarizeHistory(series);

  assert.equal(summary.launchDay.key, "2026-03-12");
  const conSalida = Math.round(summary.totalTickets / summary.daysWithData);
  assert.ok(
    summary.averageExcludingLaunch < conSalida,
    `promedio sin salida ${summary.averageExcludingLaunch} vs con salida ${conSalida}`,
  );
});

test("el mejor día por recaudación es el de salida a la venta", () => {
  const series = buildDailySeries(payload);
  const [primero, segundo] = topDays(series, 2);
  assert.equal(primero.key, "2026-03-12");
  assert.equal(segundo.key, "2026-05-01");
});

test("los días con invitaciones no inflan la recaudación", () => {
  const series = buildDailySeries(payload);
  const día = series.find((d) => d.key === "2026-04-22");
  assert.equal(día.sold, 18);
  assert.equal(día.guests, 40);
  assert.equal(día.total, 58);
  // $71.667 por vendida contra $22.241 por emitida: la diferencia es el motivo
  // de dividir siempre por `sold`.
  assert.equal(Math.round(día.net / día.sold), 71667);
  assert.equal(Math.round(día.net / día.total), 22241);
});
