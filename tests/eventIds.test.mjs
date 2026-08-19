import assert from "node:assert/strict";
import test from "node:test";
import {
  getEventFunctionIds,
  getEventsFunctionIds,
  getFunctionIdsForSelection,
  getIdsKey,
} from "../src/lib/eventIds.ts";

const event = (id, functionIds) => ({
  id,
  name: `Evento ${id}`,
  venue: "",
  city: "",
  dateISO: "2026-08-18T20:00:00-03:00",
  status: "on_sale",
  ticketsSold: 0,
  ticketsAvailable: 0,
  ticketPriceARS: 0,
  functions: functionIds?.map((functionId) => ({
    id: functionId,
    dateISO: "2026-08-18T20:00:00-03:00",
    status: "on_sale",
    ticketsSold: 0,
    grossRevenueARS: 0,
    invitations: 0,
  })),
});

test("usa el id del evento cuando todavía no tiene funciones", () => {
  assert.deepEqual(getEventFunctionIds(event("10")), ["10"]);
});

test("extrae y deduplica ids de todas las funciones", () => {
  const events = [event("a", ["1", "2"]), event("b", ["2", "3"])];
  assert.deepEqual(getEventsFunctionIds(events), ["1", "2", "3"]);
});

test("una selección devuelve solo las funciones de ese evento", () => {
  const events = [event("a", ["1", "2"]), event("b", ["3"])];
  assert.deepEqual(getFunctionIdsForSelection(events, "b"), ["3"]);
  assert.deepEqual(getFunctionIdsForSelection(events, "missing"), []);
});

test("la clave es estable sin importar orden o duplicados", () => {
  assert.equal(getIdsKey(["3", "1", "3", "2"]), "1,2,3");
});
