import assert from "node:assert/strict";
import test from "node:test";
import {
  compareEvents,
  comparePeriods,
  getEventStats,
  listEvents,
} from "../labs/agent-sdk/eventData.mjs";
import { runMockAgent } from "../labs/agent-sdk/mockAgent.mjs";

test("solo lista eventos del usuario autenticado", () => {
  const events = listEvents("demo-user");
  assert.equal(events.length, 3);
  assert.equal(events.some((event) => event.name.includes("otro productor")), false);
});

test("rechaza eventos pertenecientes a otro usuario", () => {
  assert.throws(
    () => getEventStats("demo-user", "Evento de otro productor", "this_week"),
    /No existe un evento accesible/,
  );
});

test("calcula comparaciones de eventos en código", () => {
  const result = compareEvents(
    "demo-user",
    "Festival Horizonte",
    "Noche Neón",
    "this_week",
  );
  assert.equal(result.ticketDifference, 480);
  assert.equal(result.revenueDifferenceARS, 17_440_000);
  assert.equal(result.ticketDifferencePercent, 63.2);
});

test("calcula variaciones entre períodos en código", () => {
  const result = comparePeriods("demo-user", "Festival Horizonte");
  assert.equal(result.ticketChange, 260);
  assert.equal(result.ticketChangePercent, 26.5);
  assert.equal(result.revenueChangeARS, 8_780_000);
});

test("el simulador elige la herramienta de comparación", () => {
  const calls = [];
  const answer = runMockAgent(
    "Compará Festival Horizonte con Noche Neón esta semana",
    {
      ownerId: "demo-user",
      audit: (toolName, parameters) => calls.push({ toolName, parameters }),
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].toolName, "comparar_eventos");
  assert.match(answer, /Festival Horizonte lidera/);
});
