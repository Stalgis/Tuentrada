import assert from "node:assert/strict";
import test from "node:test";
import { aggregateAvailability } from "../server/agent-service/availability.mjs";

const sector = (price_type, campos = {}) => ({
  price_type,
  total: 0,
  available: 0,
  kill: 0,
  purchase: 0,
  invitation: 0,
  booking: 0,
  issue: 0,
  promoter_blocked: 0,
  in_progress: 0,
  session_pack: 0,
  is_total_general: false,
  ...campos,
});

test("suma el mismo sector entre funciones", () => {
  const { sectores, total } = aggregateAvailability([
    [sector("Platea", { total: 100, available: 40, purchase: 55, invitation: 5 })],
    [sector("Platea", { total: 100, available: 30, purchase: 60, invitation: 10 })],
  ]);

  assert.equal(sectores.length, 1);
  assert.equal(sectores[0].sector, "Platea");
  assert.equal(sectores[0].localidades, 200);
  assert.equal(sectores[0].disponibles, 70);
  assert.equal(sectores[0].vendidas, 115);
  assert.equal(sectores[0].invitaciones, 15);
  assert.equal(total.localidades, 200);
  assert.equal(total.disponibles, 70);
});

test("bloqueadas junta kill y promoter_blocked, como hace la app", () => {
  const { sectores } = aggregateAvailability([
    [sector("Campo", { total: 50, available: 40, kill: 6, promoter_blocked: 4 })],
  ]);

  assert.equal(sectores[0].bloqueadas, 10);
});

test("vendidas no incluye invitaciones", () => {
  // Misma regla que en el resto del agente: una invitación no es una venta.
  const { sectores } = aggregateAvailability([
    [sector("Platea", { total: 100, available: 0, purchase: 70, invitation: 30 })],
  ]);

  assert.equal(sectores[0].vendidas, 70);
  assert.equal(sectores[0].invitaciones, 30);
});

test("la fila is_total_general se descarta y el total se recalcula", () => {
  // Sumarla junto a sus propias filas contaría todo dos veces.
  const { sectores, total } = aggregateAvailability([
    [
      sector("Platea", { total: 60, available: 20, purchase: 40 }),
      sector("Campo", { total: 40, available: 10, purchase: 30 }),
      sector("TOTAL", { total: 100, available: 30, purchase: 70, is_total_general: true }),
    ],
  ]);

  assert.equal(sectores.length, 2);
  assert.equal(sectores.some((s) => s.sector === "TOTAL"), false);
  assert.equal(total.localidades, 100);
  assert.equal(total.vendidas, 70);
});

test("otrosEstados cierra la cuenta cuando hay campos que no interpretamos", () => {
  // Sin este campo las partes no suman el total y el modelo inventa una
  // explicación para la diferencia.
  const { sectores } = aggregateAvailability([
    [sector("Platea", { total: 100, available: 50, purchase: 30, booking: 15, in_progress: 5 })],
  ]);

  assert.equal(sectores[0].otrosEstados, 20);
  assert.equal(
    sectores[0].disponibles +
      sectores[0].vendidas +
      sectores[0].invitaciones +
      sectores[0].bloqueadas +
      sectores[0].otrosEstados,
    sectores[0].localidades,
  );
});

test("la ocupación se calcula en código y es null sin localidades", () => {
  const { sectores } = aggregateAvailability([
    [
      sector("Platea", { total: 200, available: 50 }),
      sector("Fantasma", { total: 0, available: 0 }),
    ],
  ]);

  const platea = sectores.find((s) => s.sector === "Platea");
  const fantasma = sectores.find((s) => s.sector === "Fantasma");
  assert.equal(platea.ocupacionPorcentaje, 75);
  assert.equal(fantasma.ocupacionPorcentaje, null);
});

test("los sectores vienen ordenados por tamaño", () => {
  const { sectores } = aggregateAvailability([
    [sector("Chico", { total: 10 }), sector("Grande", { total: 500 }), sector("Medio", { total: 100 })],
  ]);

  assert.deepEqual(sectores.map((s) => s.sector), ["Grande", "Medio", "Chico"]);
});

test("un sector sin nombre no sale vacío", () => {
  const { sectores } = aggregateAvailability([[sector("  ", { total: 10 })]]);
  assert.equal(sectores[0].sector, "Sin nombre");
});

test("ningún nombre crudo del backend llega al modelo", () => {
  const serializado = JSON.stringify(
    aggregateAvailability([[sector("Platea", { total: 10, available: 5 })]]),
  );

  for (const crudo of ["price_type", "available", "promoter_blocked", "is_total_general", "session_pack"]) {
    assert.equal(serializado.includes(crudo), false, `se filtró ${crudo}`);
  }
});

test("respuestas vacías o basura no rompen", () => {
  for (const entrada of [[], [null], [[]], ["no es un array"]]) {
    const resultado = aggregateAvailability(entrada);
    assert.deepEqual(resultado.sectores, []);
    assert.equal(resultado.total.localidades, 0);
    assert.equal(resultado.total.ocupacionPorcentaje, null);
  }
});
