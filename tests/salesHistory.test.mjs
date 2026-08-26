import assert from "node:assert/strict";
import test from "node:test";
import {
  mejorDia,
  normalizeDayDate,
  toSalesHistory,
} from "../server/agent-service/salesHistory.mjs";

const dia = (day_date, sold_tickets, total_net, extra = {}) => ({
  day_date,
  day_formatted: day_date,
  sold_tickets,
  sold_guest: 0,
  total_tickets: sold_tickets,
  total_net,
  ...extra,
});

test("normaliza los dos formatos de fecha que manda el backend", () => {
  // "05/03/2026" es 5 de marzo o 3 de mayo según quién lo lea. Al modelo tiene
  // que llegar siempre YYYY-MM-DD.
  assert.equal(normalizeDayDate("2026-03-05"), "2026-03-05");
  assert.equal(normalizeDayDate("2026-03-05 00:00:00"), "2026-03-05");
  assert.equal(normalizeDayDate("05/03/2026"), "2026-03-05");
  assert.equal(normalizeDayDate("5-3-2026"), "2026-03-05");
  assert.equal(normalizeDayDate("proximamente"), "");
  assert.equal(normalizeDayDate(null), "");
});

test("la fila TOTAL sale como campo aparte, no como un día más", () => {
  // Si queda dentro de la serie el modelo la suma junto al resto y duplica todo.
  const resultado = toSalesHistory([
    dia("2026-08-01", 10, 1000),
    dia("2026-08-02", 20, 2000),
    { ...dia("", 30, 3000), day_formatted: "TOTAL" },
  ]);

  assert.equal(resultado.dias.length, 2);
  assert.equal(resultado.diasConVenta, 2);
  assert.deepEqual(resultado.total, {
    entradasPagas: 30,
    invitaciones: 0,
    entradasTotales: 30,
    recaudacionARS: 3000,
  });
  assert.equal(resultado.dias.some((d) => d.fecha === ""), false);
});

test("sin fila TOTAL el total se calcula sobre la serie completa", () => {
  const resultado = toSalesHistory([dia("2026-08-01", 10, 1000), dia("2026-08-02", 20, 2000)]);

  assert.equal(resultado.total.entradasPagas, 30);
  assert.equal(resultado.total.recaudacionARS, 3000);
});

test("ordena por fecha aunque el backend mande cualquier orden", () => {
  const resultado = toSalesHistory([
    dia("03/08/2026", 3, 300),
    dia("2026-08-01", 1, 100),
    dia("2026-08-02", 2, 200),
  ]);

  assert.deepEqual(
    resultado.dias.map((d) => d.fecha),
    ["2026-08-01", "2026-08-02", "2026-08-03"],
  );
});

test("recorta a los últimos días y el total sigue siendo el del período entero", () => {
  const noventaDias = Array.from({ length: 90 }, (_, index) => {
    const fecha = new Date(Date.UTC(2026, 5, 1 + index)).toISOString().slice(0, 10);
    return dia(fecha, 1, 100);
  });

  const resultado = toSalesHistory(noventaDias, 60);

  assert.equal(resultado.truncated, true);
  assert.equal(resultado.dias.length, 60);
  assert.equal(resultado.diasConVenta, 90);
  assert.equal(resultado.total.recaudacionARS, 9000, "el total no se recorta");
  // Se quedan los últimos, que es lo que importa para "cómo vengo".
  assert.equal(resultado.dias[resultado.dias.length - 1].fecha, "2026-08-29");
  assert.equal(resultado.dias[0].fecha, "2026-07-01");
});

test("elige el mejor día sobre la serie completa antes de recortarla", () => {
  const setentaDias = Array.from({ length: 70 }, (_, index) => {
    const fecha = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
    return dia(fecha, 1, index === 0 ? 99_999 : 100 + index);
  });

  const resultado = toSalesHistory(setentaDias, 60);

  assert.equal(resultado.dias.some((item) => item.fecha === "2026-01-01"), false);
  assert.equal(resultado.mejorDia.fecha, "2026-01-01");
  assert.equal(resultado.mejorDia.recaudacionARS, 99_999);
});

test("una serie corta no se marca como truncada", () => {
  const resultado = toSalesHistory([dia("2026-08-01", 1, 100)], 60);
  assert.equal(resultado.truncated, false);
});

test("los días con fecha ilegible se cuentan en vez de desaparecer", () => {
  // Si se descartaran en silencio el modelo afirmaría una serie completa que no
  // lo es.
  const resultado = toSalesHistory([
    dia("2026-08-01", 10, 1000),
    dia("proximamente", 5, 500),
  ]);

  assert.equal(resultado.dias.length, 1);
  assert.equal(resultado.diasIlegibles, 1);
});

test("traduce los nombres del backend y acepta strings", () => {
  const resultado = toSalesHistory([
    { day_date: "2026-08-01", day_formatted: "01/08", sold_tickets: "10", sold_guest: "2", total_tickets: "12", total_net: "1500.50" },
  ]);

  assert.deepEqual(resultado.dias[0], {
    fecha: "2026-08-01",
    entradasPagas: 10,
    invitaciones: 2,
    entradasTotales: 12,
    recaudacionARS: 1500.5,
  });
});

test("ningún nombre crudo del backend llega al modelo", () => {
  const serializado = JSON.stringify(toSalesHistory([dia("2026-08-01", 1, 100)]));
  for (const crudo of ["day_date", "day_formatted", "sold_tickets", "sold_guest", "total_net"]) {
    assert.equal(serializado.includes(crudo), false, `se filtró ${crudo}`);
  }
});

test("el mejor día lo elige el código", () => {
  const { dias } = toSalesHistory([
    dia("2026-08-01", 10, 1000),
    dia("2026-08-02", 5, 9000),
    dia("2026-08-03", 20, 2000),
  ]);

  assert.equal(mejorDia(dias).fecha, "2026-08-02");
  assert.equal(mejorDia([]), null);
});

test("una respuesta vacía o basura no rompe", () => {
  for (const entrada of [[], null, undefined, "no es un array"]) {
    const resultado = toSalesHistory(entrada);
    assert.deepEqual(resultado.dias, []);
    assert.equal(resultado.total.recaudacionARS, 0);
    assert.equal(resultado.truncated, false);
  }
});
