import assert from "node:assert/strict";
import test from "node:test";
import {
  PERIODOS_DE_VENTA,
  resolveSalesPeriod,
} from "../server/agent-service/salesPeriods.mjs";
import { PERIODOS } from "../server/agent-service/eventDateRanges.mjs";
import { ToolInputError } from "../server/agent-service/toolErrors.mjs";

const martes = new Date("2026-08-25T18:00:00-03:00");

test("los presets del backend se usan tal cual, sin recalcular fechas", () => {
  // A propósito: si definiéramos "esta semana" por nuestra cuenta y el backend
  // la cortara distinto, el agente y el dashboard dirían cifras diferentes.
  assert.deepEqual(resolveSalesPeriod({ periodoDeVenta: "esta_semana", now: martes }), {
    date: "this_week",
    etiqueta: "esta semana",
  });
  assert.equal(resolveSalesPeriod({ periodoDeVenta: "todo" }).date, "all");
  assert.equal(resolveSalesPeriod({ periodoDeVenta: "mes_pasado" }).date, "last_month");
});

test("hoy y ayer se arman como rango exacto en hora de Argentina", () => {
  // 00:30 UTC del 26 es todavía el 25 en Argentina.
  const cruceDeDia = new Date("2026-08-26T00:30:00Z");

  assert.deepEqual(resolveSalesPeriod({ periodoDeVenta: "hoy", now: cruceDeDia }), {
    date: "custom",
    dateFrom: "2026-08-25",
    dateTo: "2026-08-25",
    etiqueta: "hoy (2026-08-25)",
  });

  assert.deepEqual(resolveSalesPeriod({ periodoDeVenta: "ayer", now: cruceDeDia }), {
    date: "custom",
    dateFrom: "2026-08-24",
    dateTo: "2026-08-24",
    etiqueta: "ayer (2026-08-24)",
  });
});

test("ayer cruza bien el borde de mes", () => {
  const primeroDeMes = new Date("2026-09-01T15:00:00-03:00");
  assert.equal(
    resolveSalesPeriod({ periodoDeVenta: "ayer", now: primeroDeMes }).dateFrom,
    "2026-08-31",
  );
});

test("un rango personalizado valida formato y orden", () => {
  assert.deepEqual(
    resolveSalesPeriod({
      periodoDeVenta: "personalizado",
      ventasDesde: "2026-01-01",
      ventasHasta: "2026-01-31",
    }),
    {
      date: "custom",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      etiqueta: "del 2026-01-01 al 2026-01-31",
    },
  );

  assert.throws(
    () =>
      resolveSalesPeriod({
        periodoDeVenta: "personalizado",
        ventasDesde: "01/01/2026",
        ventasHasta: "2026-01-31",
      }),
    ToolInputError,
  );

  assert.throws(
    () =>
      resolveSalesPeriod({
        periodoDeVenta: "personalizado",
        ventasDesde: "2026-02-01",
        ventasHasta: "2026-01-01",
      }),
    ToolInputError,
  );
});

test("todo período trae una etiqueta legible para que el agente la cite", () => {
  for (const periodoDeVenta of PERIODOS_DE_VENTA) {
    if (periodoDeVenta === "personalizado") continue;
    const { etiqueta } = resolveSalesPeriod({ periodoDeVenta, now: martes });
    assert.ok(etiqueta && etiqueta.length > 2, `${periodoDeVenta} sin etiqueta`);
  }
});

test("los dos ejes temporales no comparten nombres", () => {
  // La asimetría es deliberada: es lo que evita que el modelo use uno creyendo
  // que usa el otro. `todos` filtra eventos, `todo` filtra ventas.
  const compartidos = PERIODOS_DE_VENTA.filter((periodo) => PERIODOS.includes(periodo));

  assert.deepEqual(
    compartidos.sort(),
    ["esta_semana", "este_mes", "hoy", "mes_pasado", "personalizado", "semana_pasada"],
    "si cambia esta lista, revisá que la descripción del schema siga distinguiendo los ejes",
  );
  assert.equal(PERIODOS_DE_VENTA.includes("todos"), false);
  assert.equal(PERIODOS_DE_VENTA.includes("proximos"), false, "una venta futura no existe");
  assert.equal(PERIODOS_DE_VENTA.includes("manana"), false);
});

test("un período inexistente es un error recuperable", () => {
  assert.throws(() => resolveSalesPeriod({ periodoDeVenta: "el_año_pasado" }), ToolInputError);
});
