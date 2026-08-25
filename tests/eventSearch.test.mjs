import assert from "node:assert/strict";
import test from "node:test";
import { searchEventCatalog } from "../server/agent-service/eventSearch.mjs";

test("filtra por fecha antes de aplicar el límite del modelo", () => {
  const events = Array.from({ length: 222 }, (_, index) => ({
    name: `Evento ${index + 1}`,
    dateISO:
      index >= 100 && index < 103
        ? `2026-08-${24 + (index - 100)}T21:00:00-03:00`
        : "2026-10-01T21:00:00-03:00",
    status: "on_sale",
  }));

  const result = searchEventCatalog({
    events,
    consulta: null,
    range: { from: "2026-08-24", to: "2026-08-30" },
    limite: 30,
  });

  assert.equal(result.totalAccessible, 222);
  assert.equal(result.totalMatches, 3);
  assert.equal(result.truncated, false);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["Evento 101", "Evento 102", "Evento 103"],
  );
});

test("combina búsqueda sin acentos y rango temporal", () => {
  const result = searchEventCatalog({
    events: [
      { name: "Festival Córdoba", dateISO: "2026-08-25T20:00:00-03:00" },
      { name: "Festival Córdoba", dateISO: "2026-09-25T20:00:00-03:00" },
      { name: "Concierto", dateISO: "2026-08-25T20:00:00-03:00" },
    ],
    consulta: "cordoba",
    range: { from: "2026-08-24", to: "2026-08-30" },
    limite: 30,
  });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.events[0].name, "Festival Córdoba");
});
