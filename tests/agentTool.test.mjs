import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInstructions,
  searchEventsTool,
} from "../server/agent-service/agent.mjs";
import {
  buildEventCatalog,
  resolveEventRefs,
} from "../server/agent-service/eventCatalog.mjs";
import { ReportApiError } from "../server/agent-service/reportApiClient.mjs";

const makeContext = (events, { now = new Date("2026-08-25T12:00:00-03:00") } = {}) => {
  const audit = [];
  return {
    audit,
    runContext: {
      context: {
        user: { id: "session-fp" },
        now,
        audit: (toolName, parameters) => audit.push({ toolName, parameters }),
        reports: {
          listEvents: async () => events,
        },
      },
    },
  };
};

const call = async (runContext, params) =>
  searchEventsTool.invoke(runContext, JSON.stringify(params));

const parse = (output) => (typeof output === "string" ? JSON.parse(output) : output);

test("la tool filtra por periodo y devuelve solo campos seguros", async () => {
  const { runContext, audit } = makeContext([
    { id: "1", name: "Show de hoy", fecha: "2026-08-25", dateISO: "2026-08-25T21:00:00-03:00", yaOcurrio: false },
    { id: "2", name: "Show de octubre", fecha: "2026-10-01", dateISO: "2026-10-01T21:00:00-03:00", yaOcurrio: false },
  ]);

  const result = parse(
    await call(runContext, {
      consulta: null,
      limite: 10,
      periodo: "hoy",
      fechaDesde: null,
      fechaHasta: null,
    }),
  );

  assert.equal(result.totalAccessible, 2);
  assert.equal(result.totalMatches, 1);
  assert.deepEqual(result.dateRange, { from: "2026-08-25", to: "2026-08-25" });

  const [evento] = result.eventos;
  assert.equal(evento.nombre, "Show de hoy");
  assert.equal(evento.funciones, 1);
  assert.equal(evento.funcionesEnRango, 1);
  assert.equal(evento.primeraFecha, "2026-08-25");
  assert.equal(evento.hora, "21:00");
  assert.equal(evento.yaOcurrio, false);
  assert.match(evento.ref, /^ev_[0-9a-f]{8}$/);

  // El modelo no recibe ids internos de función ni nada derivado del token.
  assert.equal("id" in evento, false);
  assert.equal(JSON.stringify(result).includes("session-fp"), false);

  assert.equal(audit[0].toolName, "buscar_eventos");
  assert.deepEqual(audit[0].parameters.rangoResuelto, { from: "2026-08-25", to: "2026-08-25" });
});

test("la tool agrupa funciones en un solo evento", async () => {
  const { runContext } = makeContext([
    { id: "1", name: "Unipersonal", fecha: "2026-09-01", dateISO: "2026-09-01T21:00:00-03:00", yaOcurrio: false },
    { id: "2", name: "Unipersonal", fecha: "2026-09-02", dateISO: "2026-09-02T21:00:00-03:00", yaOcurrio: false },
    { id: "3", name: "Unipersonal", fecha: "2026-09-03", dateISO: "2026-09-03T21:00:00-03:00", yaOcurrio: false },
  ]);

  const result = parse(
    await call(runContext, {
      consulta: null,
      limite: 10,
      periodo: "todos",
      fechaDesde: null,
      fechaHasta: null,
    }),
  );

  assert.equal(result.totalAccessible, 1, "tres funciones son un evento, no tres");
  assert.equal(result.eventos[0].funciones, 3);
  assert.equal(result.eventos[0].primeraFecha, "2026-09-01");
  assert.equal(result.eventos[0].ultimaFecha, "2026-09-03");
  // Con varias funciones una hora suelta confunde más de lo que ayuda.
  assert.equal(result.eventos[0].hora, null);
  // Sin filtro temporal no tiene sentido informar cuántas funciones caen.
  assert.equal("funcionesEnRango" in result.eventos[0], false);
});

test("el ref que devuelve la tool resuelve al mismo evento", async () => {
  const funciones = [
    { id: "11", name: "Unipersonal", fecha: "2026-09-01", dateISO: "2026-09-01T21:00:00-03:00", yaOcurrio: false },
    { id: "12", name: "Unipersonal", fecha: "2026-09-02", dateISO: "2026-09-02T21:00:00-03:00", yaOcurrio: false },
    { id: "99", name: "Otro", fecha: "2026-09-03", dateISO: "2026-09-03T21:00:00-03:00", yaOcurrio: false },
  ];
  const { runContext } = makeContext(funciones);

  const result = parse(
    await call(runContext, {
      consulta: "unipersonal",
      limite: 10,
      periodo: "todos",
      fechaDesde: null,
      fechaHasta: null,
    }),
  );

  // Es el contrato que van a usar las tools de ventas: del ref que ve el
  // modelo se llega a los ids de función, sin que el modelo los toque.
  const catalog = buildEventCatalog(funciones);
  const { funcionIds } = resolveEventRefs(catalog, [result.eventos[0].ref]);
  assert.deepEqual(funcionIds, ["11", "12"]);
});

test("proximos usa el rango abierto y deja fuera lo que ya paso", async () => {
  const { runContext } = makeContext([
    { id: "1", name: "Pasado", fecha: "2026-08-01", dateISO: "2026-08-01T21:00:00-03:00", yaOcurrio: true },
    { id: "2", name: "Futuro lejano", fecha: "2031-01-01", dateISO: "2031-01-01T21:00:00-03:00", yaOcurrio: false },
  ]);

  const result = parse(
    await call(runContext, {
      consulta: null,
      limite: 10,
      periodo: "proximos",
      fechaDesde: null,
      fechaHasta: null,
    }),
  );

  assert.equal(result.totalMatches, 1);
  assert.equal(result.eventos[0].nombre, "Futuro lejano");
  assert.deepEqual(result.dateRange, { from: "2026-08-25", to: null });
});

test("un rango invertido vuelve al modelo como texto, no como fallo", async () => {
  // Con errorFunction: null esto subia hasta el httpServer y salia 500.
  const { runContext } = makeContext([]);

  const output = await call(runContext, {
    consulta: null,
    limite: 10,
    periodo: "personalizado",
    fechaDesde: "2026-09-10",
    fechaHasta: "2026-09-01",
  });

  assert.equal(typeof output, "string");
  assert.match(output, /fechaDesde no puede ser posterior/);
  assert.match(output, /volvé a llamar la herramienta/i);
});

test("un formato de fecha invalido tambien es recuperable", async () => {
  const { runContext } = makeContext([]);

  const output = await call(runContext, {
    consulta: null,
    limite: 10,
    periodo: "personalizado",
    fechaDesde: "10/09/2026",
    fechaHasta: "2026-09-20",
  });

  assert.match(String(output), /YYYY-MM-DD/);
});

test("un fallo del backend sube: el modelo no puede corregir eso", async () => {
  const runContext = {
    context: {
      user: { id: "session-fp" },
      now: new Date("2026-08-25T12:00:00-03:00"),
      audit: () => {},
      reports: {
        listEvents: async () => {
          throw new ReportApiError(500, "backend caido");
        },
      },
    },
  };

  await assert.rejects(
    () =>
      call(runContext, {
        consulta: null,
        limite: 10,
        periodo: "todos",
        fechaDesde: null,
        fechaHasta: null,
      }),
    ReportApiError,
  );
});

test("sin contexto autenticado la tool no corre", async () => {
  await assert.rejects(
    () =>
      call(
        {},
        { consulta: null, limite: 10, periodo: "todos", fechaDesde: null, fechaHasta: null },
      ),
    /contexto autenticado/,
  );
});

test("las instrucciones traen la fecha de hoy en hora de Argentina", () => {
  // Sin esto el modelo no sabe que dia es y tiene que inventar el año al
  // completar un rango personalizado.
  const instructions = buildInstructions({
    context: { now: new Date("2026-08-26T00:30:00Z") },
  });

  assert.match(instructions, /hoy es martes 2026-08-25 en Argentina/);
  assert.match(instructions, /proximos/);
  assert.match(instructions, /mes_pasado/);
  assert.match(instructions, /yaOcurrio/);
  assert.match(instructions, /contá eventos/);
  assert.match(instructions, /No lo muestres al usuario ni lo inventes/);
  // Las dos reglas que evitan las alucinaciones caras sobre plata.
  assert.match(instructions, /periodo y periodoDeVenta son cosas distintas/);
  assert.match(instructions, /No hagas cuentas/);
  assert.match(instructions, /entradasPagas e invitaciones son cosas distintas/);
  // Reglas del paso 3: los tres campos calculados que el modelo no debe rehacer.
  assert.match(instructions, /mejorDia ya viene elegido/);
  assert.match(instructions, /porcentajeDeRecaudacion ya viene calculado/);
  assert.match(instructions, /otrosEstados junta localidades/);
  assert.match(instructions, /vendidas no incluye invitaciones/);
  // La app sólo renderiza negrita y viñetas: pedir tablas o títulos dejaría
  // símbolos sueltos en pantalla.
  assert.match(instructions, /No uses títulos, tablas, código ni links/);
  assert.match(instructions, /sinFecha/);
});
