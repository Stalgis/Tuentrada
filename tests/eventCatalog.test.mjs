import assert from "node:assert/strict";
import test from "node:test";
import {
  allFunctionIds,
  buildEventCatalog,
  eventRef,
  resolveEventRefs,
} from "../server/agent-service/eventCatalog.mjs";
import { ToolInputError } from "../server/agent-service/toolErrors.mjs";

const funcion = (id, name, fecha, yaOcurrio = false) => ({
  id,
  name,
  fecha,
  dateISO: fecha ? `${fecha}T21:00:00-03:00` : "",
  yaOcurrio: fecha ? yaOcurrio : null,
});

test("diez funciones del mismo espectáculo son un evento, no diez", () => {
  // El bug que motivó todo esto: el agente contaba funciones y las llamaba
  // eventos, así que un unipersonal de 10 fechas sonaba como 10 eventos.
  const funciones = Array.from({ length: 10 }, (_, index) =>
    funcion(String(index + 1), "Unipersonal", `2026-09-${String(index + 1).padStart(2, "0")}`),
  );

  const { eventos } = buildEventCatalog(funciones);

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].nombre, "Unipersonal");
  assert.equal(eventos[0].funciones.length, 10);
  assert.equal(eventos[0].primeraFecha, "2026-09-01");
  assert.equal(eventos[0].ultimaFecha, "2026-09-10");
});

test("agrupa ignorando acentos, mayúsculas y espacios de más", () => {
  const { eventos } = buildEventCatalog([
    funcion("1", "Festival Córdoba", "2026-08-25"),
    funcion("2", "FESTIVAL  CORDOBA", "2026-08-26"),
    funcion("3", "festival córdoba", "2026-08-27"),
  ]);

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].funciones.length, 3);
  // Se conserva el nombre tal como vino la primera función, no el normalizado.
  assert.equal(eventos[0].nombre, "Festival Córdoba");
});

test("el ref es estable entre llamadas y distinto entre eventos", () => {
  const primero = buildEventCatalog([funcion("1", "Festival Córdoba", "2026-08-25")]);
  const segundo = buildEventCatalog([
    funcion("9", "festival  cordoba", "2027-01-01"),
    funcion("10", "Otro Evento", "2027-01-02"),
  ]);

  assert.equal(primero.eventos[0].ref, segundo.eventos[0].ref);
  assert.notEqual(segundo.eventos[0].ref, segundo.eventos[1].ref);
  assert.match(primero.eventos[0].ref, /^ev_[0-9a-f]{8}$/);
  assert.equal(eventRef("FESTIVAL CORDOBA"), primero.eventos[0].ref);
});

test("resolver un ref devuelve exactamente los ids de función de ese evento", () => {
  const catalog = buildEventCatalog([
    funcion("11", "Unipersonal", "2026-09-01"),
    funcion("12", "Unipersonal", "2026-09-02"),
    funcion("99", "Otro", "2026-09-03"),
  ]);
  const [unipersonal] = catalog.eventos;

  const { eventos, funcionIds } = resolveEventRefs(catalog, [unipersonal.ref]);

  assert.deepEqual(funcionIds, ["11", "12"]);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].nombre, "Unipersonal");
});

test("refs repetidos no duplican ids", () => {
  const catalog = buildEventCatalog([
    funcion("11", "Unipersonal", "2026-09-01"),
    funcion("12", "Unipersonal", "2026-09-02"),
  ]);
  const { ref } = catalog.eventos[0];

  assert.deepEqual(resolveEventRefs(catalog, [ref, ref]).funcionIds, ["11", "12"]);
});

test("un ref inventado falla limpio, sin devolver datos de otro evento", () => {
  // Es la garantía central del diseño: el modelo nunca puede alucinar un
  // identificador y recibir la recaudación de un evento que no era.
  const catalog = buildEventCatalog([funcion("1", "Festival", "2026-08-25")]);

  assert.throws(() => resolveEventRefs(catalog, ["ev_deadbeef"]), ToolInputError);
  assert.throws(
    () => resolveEventRefs(catalog, ["ev_deadbeef"]),
    /buscar_eventos/,
    "el mensaje tiene que decirle al modelo cómo conseguir refs válidos",
  );
});

test("una lista de refs vacía es un error recuperable, no un conjunto vacío", () => {
  const catalog = buildEventCatalog([funcion("1", "Festival", "2026-08-25")]);

  assert.throws(() => resolveEventRefs(catalog, []), ToolInputError);
  assert.throws(() => resolveEventRefs(catalog, undefined), ToolInputError);
});

test("yaOcurrio a nivel evento no afirma de más", () => {
  const todasPasaron = buildEventCatalog([
    funcion("1", "Pasado", "2026-01-01", true),
    funcion("2", "Pasado", "2026-01-02", true),
  ]);
  assert.equal(todasPasaron.eventos[0].yaOcurrio, true);

  const algunaFutura = buildEventCatalog([
    funcion("1", "Mixto", "2026-01-01", true),
    funcion("2", "Mixto", "2027-01-01", false),
  ]);
  assert.equal(algunaFutura.eventos[0].yaOcurrio, false);

  // Pasadas + una sin fecha: no alcanza para decir que ya ocurrió todo.
  const incierto = buildEventCatalog([
    funcion("1", "Incierto", "2026-01-01", true),
    funcion("2", "Incierto", ""),
  ]);
  assert.equal(incierto.eventos[0].yaOcurrio, null);
});

test("allFunctionIds junta todo el catálogo sin repetir", () => {
  const catalog = buildEventCatalog([
    funcion("1", "A", "2026-09-01"),
    funcion("2", "A", "2026-09-02"),
    funcion("3", "B", "2026-09-03"),
  ]);

  assert.deepEqual(allFunctionIds(catalog), ["1", "2", "3"]);
});

test("un catálogo vacío no rompe", () => {
  const catalog = buildEventCatalog([]);
  assert.deepEqual(catalog.eventos, []);
  assert.deepEqual(allFunctionIds(catalog), []);
});
