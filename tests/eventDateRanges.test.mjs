import assert from "node:assert/strict";
import test from "node:test";
import {
  eventIsWithinRange,
  resolveEventDateRange,
} from "../server/agent-service/eventDateRanges.mjs";

const tuesdayInArgentina = new Date("2026-08-25T12:00:00-03:00");

test("esta semana abarca de lunes a domingo en Argentina", () => {
  assert.deepEqual(
    resolveEventDateRange({ periodo: "esta_semana", now: tuesdayInArgentina }),
    { from: "2026-08-24", to: "2026-08-30" },
  );
});

test("semana pasada termina el domingo anterior", () => {
  assert.deepEqual(
    resolveEventDateRange({ periodo: "semana_pasada", now: tuesdayInArgentina }),
    { from: "2026-08-17", to: "2026-08-23" },
  );
});

test("esta semana funciona cuando hoy es domingo", () => {
  assert.deepEqual(
    resolveEventDateRange({
      periodo: "esta_semana",
      now: new Date("2026-08-30T20:00:00-03:00"),
    }),
    { from: "2026-08-24", to: "2026-08-30" },
  );
});

test("este mes respeta el último día del mes", () => {
  assert.deepEqual(
    resolveEventDateRange({ periodo: "este_mes", now: tuesdayInArgentina }),
    { from: "2026-08-01", to: "2026-08-31" },
  );
});

test("un rango personalizado valida orden y formato", () => {
  assert.deepEqual(
    resolveEventDateRange({
      periodo: "personalizado",
      fechaDesde: "2026-09-01",
      fechaHasta: "2026-09-15",
    }),
    { from: "2026-09-01", to: "2026-09-15" },
  );

  assert.throws(
    () =>
      resolveEventDateRange({
        periodo: "personalizado",
        fechaDesde: "15/09/2026",
        fechaHasta: "2026-09-01",
      }),
    /YYYY-MM-DD/,
  );
});

test("el filtro incluye los límites y excluye eventos sin fecha", () => {
  const range = { from: "2026-08-24", to: "2026-08-30" };
  assert.equal(eventIsWithinRange({ dateISO: "2026-08-24T00:00:00-03:00" }, range), true);
  assert.equal(eventIsWithinRange({ dateISO: "2026-08-30T23:59:59-03:00" }, range), true);
  assert.equal(eventIsWithinRange({ dateISO: "2026-08-31T00:00:00-03:00" }, range), false);
  assert.equal(eventIsWithinRange({ dateISO: "" }, range), false);
});
