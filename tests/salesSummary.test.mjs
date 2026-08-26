import assert from "node:assert/strict";
import test from "node:test";
import {
  compararResumenes,
  toSalesSummary,
} from "../server/agent-service/salesSummary.mjs";

const statsCrudas = {
  tickets: 850,
  invitations: 120,
  total_tickets: 970,
  total: 4_250_000,
  ticket_medio: 4382.47,
  unique_buyers: 610,
  chartTickets: [1, 2, 3],
  chartInvitations: [1],
  chartTotalTickets: [1],
  chartTotal: [1],
  chartUniqueBuyers: [1],
};

test("traduce los nombres del backend a nombres que no mienten", () => {
  const resumen = toSalesSummary(statsCrudas);

  assert.equal(resumen.entradasPagas, 850);
  assert.equal(resumen.invitaciones, 120);
  assert.equal(resumen.entradasTotales, 970);
  assert.equal(resumen.recaudacionARS, 4_250_000);
  assert.equal(resumen.compradoresUnicos, 610);
});

test("ningún nombre crudo del backend llega al modelo", () => {
  // `total` es plata y `total_tickets` es cantidad: un modelo que ve los dos
  // juntos puede decir "vendiste 4.250.000 entradas".
  const claves = Object.keys(toSalesSummary(statsCrudas));

  for (const crudo of [
    "total",
    "tickets",
    "invitations",
    "total_tickets",
    "ticket_medio",
    "unique_buyers",
  ]) {
    assert.equal(claves.includes(crudo), false, `se filtró el campo crudo ${crudo}`);
  }
});

test("los arrays de gráfico no salen: son ruido y tokens", () => {
  const serializado = JSON.stringify(toSalesSummary(statsCrudas));
  assert.equal(serializado.includes("chart"), false);
});

test("el precio promedio se calcula sobre entradas pagas, no sobre el total", () => {
  // Igual que la app: recaudación sobre entradas pagas, sin contar invitaciones.
  const resumen = toSalesSummary(statsCrudas);
  assert.equal(resumen.precioPromedioARS, 4_250_000 / 850);
});

test("sin entradas pagas el precio promedio es cero, no NaN ni Infinity", () => {
  const resumen = toSalesSummary({ tickets: 0, total: 0, invitations: 40 });
  assert.equal(resumen.precioPromedioARS, 0);
  assert.equal(resumen.invitaciones, 40);
});

test("acepta números que vienen como string y campos ausentes", () => {
  const resumen = toSalesSummary({ total: "4250000.50", tickets: "10" });

  assert.equal(resumen.recaudacionARS, 4250000.5);
  assert.equal(resumen.entradasPagas, 10);
  assert.equal(resumen.compradoresUnicos, 0);
});

test("una respuesta nula o basura no rompe", () => {
  for (const entrada of [null, undefined, {}, { total: "no es un número" }]) {
    const resumen = toSalesSummary(entrada);
    assert.equal(resumen.recaudacionARS, 0);
    assert.equal(resumen.entradasPagas, 0);
  }
});

test("la variación la calcula el código, no el modelo", () => {
  const actual = toSalesSummary({ tickets: 150, total: 1500, unique_buyers: 100 });
  const previo = toSalesSummary({ tickets: 100, total: 1000, unique_buyers: 100 });

  const variacion = compararResumenes(actual, previo);

  assert.deepEqual(variacion.entradasPagas, { diferencia: 50, porcentaje: 50 });
  assert.deepEqual(variacion.recaudacionARS, { diferencia: 500, porcentaje: 50 });
  assert.deepEqual(variacion.compradoresUnicos, { diferencia: 0, porcentaje: 0 });
});

test("una caída da diferencia y porcentaje negativos", () => {
  const variacion = compararResumenes(
    toSalesSummary({ total: 750 }),
    toSalesSummary({ total: 1000 }),
  );

  assert.deepEqual(variacion.recaudacionARS, { diferencia: -250, porcentaje: -25 });
});

test("dividir por cero da porcentaje null, no Infinity ni un 100% inventado", () => {
  // El modelo tiene una regla para este caso: decir que el período anterior fue
  // cero. Si le mandáramos Infinity o 100 diría cualquier cosa.
  const variacion = compararResumenes(
    toSalesSummary({ total: 5000, tickets: 3 }),
    toSalesSummary({ total: 0, tickets: 0 }),
  );

  assert.equal(variacion.recaudacionARS.porcentaje, null);
  assert.equal(variacion.recaudacionARS.diferencia, 5000);
  assert.equal(variacion.entradasPagas.porcentaje, null);
});

test("el porcentaje se redondea a dos decimales", () => {
  const variacion = compararResumenes(
    toSalesSummary({ total: 1000 }),
    toSalesSummary({ total: 3000 }),
  );

  assert.equal(variacion.recaudacionARS.porcentaje, -66.67);
});
