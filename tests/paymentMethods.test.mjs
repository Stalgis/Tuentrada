import assert from "node:assert/strict";
import test from "node:test";
import { toPaymentMethods } from "../server/agent-service/paymentMethods.mjs";

test("traduce, ordena de mayor a menor y calcula el porcentaje", () => {
  const { medios, recaudacionTotalARS, entradasTotales } = toPaymentMethods([
    { payment_name: "Efectivo", sold_tickets: 20, total_revenue: 250_000 },
    { payment_name: "Tarjeta de crédito", sold_tickets: 80, total_revenue: 750_000 },
  ]);

  // El principal queda primero: el modelo no tiene que ordenar nada.
  assert.equal(medios[0].medio, "Tarjeta de crédito");
  assert.equal(medios[0].porcentajeDeRecaudacion, 75);
  assert.equal(medios[1].medio, "Efectivo");
  assert.equal(medios[1].porcentajeDeRecaudacion, 25);
  assert.equal(recaudacionTotalARS, 1_000_000);
  assert.equal(entradasTotales, 100);
});

test("total_revenue como string se normaliza", () => {
  // Es lo que ya hace el cliente de la app: el backend lo manda de las dos formas.
  const { medios, recaudacionTotalARS } = toPaymentMethods([
    { payment_name: "Transferencia", sold_tickets: "3", total_revenue: "1500.75" },
  ]);

  assert.equal(medios[0].recaudacionARS, 1500.75);
  assert.equal(medios[0].entradas, 3);
  assert.equal(recaudacionTotalARS, 1500.75);
});

test("con recaudación cero el porcentaje es null, no NaN", () => {
  const { medios } = toPaymentMethods([
    { payment_name: "Cortesía", sold_tickets: 5, total_revenue: 0 },
  ]);

  assert.equal(medios[0].porcentajeDeRecaudacion, null);
});

test("un medio sin nombre no sale vacío", () => {
  const { medios } = toPaymentMethods([{ payment_name: "  ", sold_tickets: 1, total_revenue: 10 }]);
  assert.equal(medios[0].medio, "Sin identificar");
});

test("el campo se llama entradas, no entradasPagas", () => {
  // Si el backend emitiera una fila "Invitación", llamarlas pagas sería falso.
  const { medios } = toPaymentMethods([
    { payment_name: "Efectivo", sold_tickets: 1, total_revenue: 10 },
  ]);

  assert.equal("entradas" in medios[0], true);
  assert.equal("entradasPagas" in medios[0], false);
});

test("ningún nombre crudo del backend llega al modelo", () => {
  const serializado = JSON.stringify(
    toPaymentMethods([{ payment_name: "Efectivo", sold_tickets: 1, total_revenue: 10 }]),
  );

  for (const crudo of ["payment_name", "sold_tickets", "total_revenue"]) {
    assert.equal(serializado.includes(crudo), false, `se filtró ${crudo}`);
  }
});

test("una respuesta vacía o basura no rompe", () => {
  for (const entrada of [[], null, undefined, "no es un array"]) {
    const resultado = toPaymentMethods(entrada);
    assert.deepEqual(resultado.medios, []);
    assert.equal(resultado.recaudacionTotalARS, 0);
  }
});
