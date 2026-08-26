import assert from "node:assert/strict";
import test from "node:test";
import { buildEventCatalog } from "../server/agent-service/eventCatalog.mjs";
import { searchEventCatalog } from "../server/agent-service/eventSearch.mjs";

const buscar = ({ funciones, consulta = null, range = null, limite = 30 }) =>
  searchEventCatalog({
    eventos: buildEventCatalog(funciones).eventos,
    consulta,
    range,
    limite,
  });

const nombres = (result) => result.matches.map(({ evento }) => evento.nombre);

test("filtra por fecha antes de aplicar el límite del modelo", () => {
  const funciones = Array.from({ length: 222 }, (_, index) => ({
    id: String(index + 1),
    name: `Evento ${index + 1}`,
    fecha: index >= 100 && index < 103 ? `2026-08-${24 + (index - 100)}` : "2026-10-01",
  }));

  const result = buscar({
    funciones,
    range: { from: "2026-08-24", to: "2026-08-30" },
  });

  assert.equal(result.totalAccessible, 222);
  assert.equal(result.totalMatches, 3);
  assert.equal(result.truncated, false);
  assert.deepEqual(nombres(result), ["Evento 101", "Evento 102", "Evento 103"]);
});

test("combina búsqueda sin acentos y rango temporal", () => {
  const result = buscar({
    funciones: [
      { id: "1", name: "Festival Córdoba", fecha: "2026-08-25" },
      { id: "2", name: "Festival Rosario", fecha: "2026-09-25" },
      { id: "3", name: "Concierto", fecha: "2026-08-25" },
    ],
    consulta: "cordoba",
    range: { from: "2026-08-24", to: "2026-08-30" },
  });

  assert.equal(result.totalMatches, 1);
  assert.equal(nombres(result)[0], "Festival Córdoba");
});

test("un evento de varias funciones se cuenta una sola vez", () => {
  // El bug que motivó agrupar: antes esto reportaba 10 eventos.
  const funciones = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1),
    name: "Unipersonal",
    fecha: `2026-09-${String(index + 1).padStart(2, "0")}`,
  }));

  const result = buscar({ funciones });

  assert.equal(result.totalAccessible, 1);
  assert.equal(result.totalMatches, 1);
  assert.equal(result.matches[0].evento.funciones.length, 10);
});

test("un evento entra al rango si al menos una función cae adentro", () => {
  const result = buscar({
    funciones: [
      { id: "1", name: "Unipersonal", fecha: "2026-08-01" },
      { id: "2", name: "Unipersonal", fecha: "2026-08-26" },
      { id: "3", name: "Unipersonal", fecha: "2026-12-01" },
    ],
    range: { from: "2026-08-24", to: "2026-08-30" },
  });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.matches[0].funcionesEnRango, 1);
  assert.equal(result.matches[0].evento.funciones.length, 3);
});

test("cuenta los eventos sin fecha que el filtro temporal dejó afuera", () => {
  const result = buscar({
    funciones: [
      { id: "1", name: "Con fecha", fecha: "2026-08-25" },
      { id: "2", name: "Sin fecha A", fecha: "" },
      { id: "3", name: "Sin fecha B", fecha: "" },
    ],
    range: { from: "2026-08-24", to: "2026-08-30" },
  });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.sinFecha, 2);
});

test("un evento con alguna función sin fecha no cuenta como sin fecha", () => {
  const result = buscar({
    funciones: [
      { id: "1", name: "Mixto", fecha: "2026-08-25" },
      { id: "2", name: "Mixto", fecha: "" },
    ],
    range: { from: "2026-08-24", to: "2026-08-30" },
  });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.sinFecha, 0);
});

test("sin filtro temporal no se reportan eventos sin fecha", () => {
  const result = buscar({
    funciones: [
      { id: "1", name: "Con fecha", fecha: "2026-08-25" },
      { id: "2", name: "Sin fecha", fecha: "" },
    ],
  });

  assert.equal(result.totalMatches, 2);
  assert.equal(result.sinFecha, 0);
});

test("sinFecha sólo cuenta los que además coinciden por nombre", () => {
  const result = buscar({
    funciones: [
      { id: "1", name: "Festival sin fecha", fecha: "" },
      { id: "2", name: "Otra cosa sin fecha", fecha: "" },
    ],
    consulta: "festival",
    range: { from: "2026-08-24", to: "2026-08-30" },
  });

  assert.equal(result.totalMatches, 0);
  assert.equal(result.sinFecha, 1);
});
