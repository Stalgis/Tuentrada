import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStatsProgressToFlatEvents,
  applyStatsToFlatEvents,
} from "../src/lib/eventStats.ts";

const event = (id) => ({
  id,
  name: `Evento ${id}`,
  venue: "",
  city: "",
  dateISO: "2026-08-06T20:00:00-03:00",
  status: "on_sale",
  ticketsSold: 0,
  ticketsAvailable: 0,
  ticketPriceARS: 0,
});

test("distingue estadísticas reales de funciones fallidas", () => {
  const result = applyStatsToFlatEvents(
    [event("ok"), event("failed")],
    { ok: { total: 25000, tickets: 10, invitations: 2 } },
  );

  assert.deepEqual(
    {
      status: result[0].statsStatus,
      total: result[0].grossRevenueARS,
      tickets: result[0].ticketsSold,
      invitations: result[0].invitations,
    },
    { status: "loaded", total: 25000, tickets: 10, invitations: 2 },
  );
  assert.equal(result[1].statsStatus, "error");
});

test("publica stats disponibles sin marcar como fallidas las pendientes", () => {
  const result = applyStatsProgressToFlatEvents(
    [event("loaded"), event("pending"), event("failed")],
    { loaded: { total: 12000, tickets: 4, invitations: 1 } },
    ["failed"],
  );

  assert.equal(result[0].statsStatus, "loaded");
  assert.equal(result[0].grossRevenueARS, 12000);
  assert.equal(result[1].statsStatus, undefined);
  assert.equal(result[2].statsStatus, "error");
});
