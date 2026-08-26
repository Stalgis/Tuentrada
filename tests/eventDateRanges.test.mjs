import assert from "node:assert/strict";
import test from "node:test";
import {
  eventIsWithinRange,
  resolveEventDateRange,
  todayInArgentina,
  weekdayInArgentina,
} from "../server/agent-service/eventDateRanges.mjs";
import { ToolInputError } from "../server/agent-service/toolErrors.mjs";

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
  assert.equal(eventIsWithinRange({ fecha: "2026-08-24" }, range), true);
  assert.equal(eventIsWithinRange({ fecha: "2026-08-30" }, range), true);
  assert.equal(eventIsWithinRange({ fecha: "2026-08-31" }, range), false);
  assert.equal(eventIsWithinRange({ fecha: "" }, range), false);
});

test("proximos es un rango abierto desde hoy", () => {
  const range = resolveEventDateRange({ periodo: "proximos", now: tuesdayInArgentina });
  assert.deepEqual(range, { from: "2026-08-25", to: null });

  assert.equal(eventIsWithinRange({ fecha: "2026-08-24" }, range), false);
  assert.equal(eventIsWithinRange({ fecha: "2026-08-25" }, range), true);
  assert.equal(eventIsWithinRange({ fecha: "2031-01-01" }, range), true);
  assert.equal(eventIsWithinRange({ fecha: "" }, range), false);
});

test("mes pasado y proximo mes cruzan el borde de año", () => {
  const enero = new Date("2026-01-15T12:00:00-03:00");
  assert.deepEqual(resolveEventDateRange({ periodo: "mes_pasado", now: enero }), {
    from: "2025-12-01",
    to: "2025-12-31",
  });

  const diciembre = new Date("2026-12-10T12:00:00-03:00");
  assert.deepEqual(resolveEventDateRange({ periodo: "proximo_mes", now: diciembre }), {
    from: "2027-01-01",
    to: "2027-01-31",
  });
});

test("los errores de parametros son ToolInputError, no errores genericos", () => {
  // El agente los devuelve al modelo para que corrija; un Error suelto subiria
  // hasta el httpServer y saldria 500.
  assert.throws(
    () => resolveEventDateRange({ periodo: "personalizado", fechaDesde: "hoy", fechaHasta: "2026-01-01" }),
    ToolInputError,
  );
  assert.throws(
    () => resolveEventDateRange({ periodo: "personalizado", fechaDesde: "2026-02-01", fechaHasta: "2026-01-01" }),
    ToolInputError,
  );
});

test("la fecha y el dia de la semana salen en hora de Argentina", () => {
  // 00:30 UTC del 26 es todavia el 25 en Argentina.
  const cruceDeDia = new Date("2026-08-26T00:30:00Z");
  assert.equal(todayInArgentina(cruceDeDia), "2026-08-25");
  assert.equal(weekdayInArgentina(cruceDeDia), "martes");
});
