import assert from "node:assert/strict";
import test from "node:test";
import { salesSummaryTool } from "../server/agent-service/agent.mjs";
import { buildEventCatalog } from "../server/agent-service/eventCatalog.mjs";
import {
  ReportApiError,
  ReportTimeoutError,
} from "../server/agent-service/reportApiClient.mjs";

const FUNCIONES = [
  { id: "11", name: "Unipersonal", fecha: "2026-09-01", dateISO: "2026-09-01T21:00:00-03:00", yaOcurrio: false },
  { id: "12", name: "Unipersonal", fecha: "2026-09-02", dateISO: "2026-09-02T21:00:00-03:00", yaOcurrio: false },
  { id: "99", name: "Festival", fecha: "2026-10-01", dateISO: "2026-10-01T20:00:00-03:00", yaOcurrio: false },
];

const refDe = (nombre) =>
  buildEventCatalog(FUNCIONES).eventos.find((evento) => evento.nombre === nombre).ref;

const makeContext = ({ funciones = FUNCIONES, fetchStats } = {}) => {
  const llamadas = [];
  const audit = [];
  return {
    llamadas,
    audit,
    runContext: {
      context: {
        user: { id: "session-fp" },
        now: new Date("2026-08-25T18:00:00-03:00"),
        audit: (toolName, parameters) => audit.push({ toolName, parameters }),
        reports: {
          listEvents: async () => funciones,
          fetchStats: async (ids, period) => {
            llamadas.push({ ids, period });
            if (fetchStats) return fetchStats(ids, period);
            return { tickets: 100, invitations: 10, total_tickets: 110, total: 500_000, unique_buyers: 80 };
          },
        },
      },
    },
  };
};

const call = async (runContext, params) =>
  salesSummaryTool.invoke(runContext, JSON.stringify({
    refs: null, periodoDeVenta: "todo", ventasDesde: null, ventasHasta: null, compararCon: null,
    ...params,
  }));

const parse = (output) => (typeof output === "string" ? JSON.parse(output) : output);

test("sin refs consulta toda la cuenta", async () => {
  const { runContext, llamadas } = makeContext();

  const result = parse(await call(runContext, { refs: null, periodoDeVenta: "este_mes" }));

  // La conversión a ids numéricos la hace el cliente real, no esta capa; se
  // verifica en tests/reportApiClient.test.mjs.
  assert.deepEqual(llamadas[0].ids, ["11", "12", "99"]);
  assert.deepEqual(llamadas[0].period, { date: "this_month", etiqueta: "este mes" });
  assert.equal(result.alcance, "toda la cuenta");
  assert.equal(result.funcionesIncluidas, 3);
  assert.equal(result.periodoAplicado, "este mes");
  assert.equal(result.recaudacionARS, 500_000);
});

test("con un ref consulta sólo las funciones de ese evento", async () => {
  const { runContext, llamadas } = makeContext();

  const result = parse(await call(runContext, { refs: [refDe("Unipersonal")] }));

  assert.deepEqual(llamadas[0].ids, ["11", "12"], "no entra la función del otro evento");
  assert.equal(result.alcance, "Unipersonal");
  assert.equal(result.funcionesIncluidas, 2);
});

test("un ref inventado no llega nunca al backend", async () => {
  // La garantía central: el agente no puede devolver la recaudación de un
  // evento que no era.
  const { runContext, llamadas } = makeContext();

  const output = await call(runContext, { refs: ["ev_deadbeef"] });

  assert.equal(llamadas.length, 0);
  assert.match(String(output), /no existen en el catálogo/);
  assert.match(String(output), /buscar_eventos/);
});

test("un array de refs vacío no amplía silenciosamente el alcance", async () => {
  const { runContext, llamadas } = makeContext();

  const output = await call(runContext, { refs: [] });

  assert.equal(llamadas.length, 0);
  assert.match(String(output), /al menos un ref|buscar_eventos/);
});

test("el período de venta no toca el filtro de fecha de evento", async () => {
  // Los dos ejes son independientes: pedir ventas de la semana pasada no
  // cambia qué funciones se consultan.
  const { runContext, llamadas } = makeContext();

  await call(runContext, { refs: null, periodoDeVenta: "semana_pasada" });
  await call(runContext, { refs: null, periodoDeVenta: "todo" });

  assert.deepEqual(llamadas[0].ids, llamadas[1].ids);
  assert.equal(llamadas[0].period.date, "last_week");
  assert.equal(llamadas[1].period.date, "all");
});

test("un rango de venta personalizado viaja como custom", async () => {
  const { runContext, llamadas } = makeContext();

  const result = parse(await call(runContext, {
    periodoDeVenta: "personalizado",
    ventasDesde: "2026-01-01",
    ventasHasta: "2026-01-31",
  }));

  assert.deepEqual(llamadas[0].period, {
    date: "custom", dateFrom: "2026-01-01", dateTo: "2026-01-31",
    etiqueta: "del 2026-01-01 al 2026-01-31",
  });
  assert.equal(result.periodoAplicado, "del 2026-01-01 al 2026-01-31");
});

test("comparar pide los dos períodos y devuelve la variación calculada", async () => {
  const porPeriodo = {
    this_month: { tickets: 150, total: 1500, invitations: 0, total_tickets: 150, unique_buyers: 100 },
    last_month: { tickets: 100, total: 1000, invitations: 0, total_tickets: 100, unique_buyers: 80 },
  };
  const { runContext, llamadas } = makeContext({
    fetchStats: async (_ids, period) => porPeriodo[period.date],
  });

  const result = parse(await call(runContext, {
    periodoDeVenta: "este_mes",
    compararCon: "mes_pasado",
  }));

  assert.equal(llamadas.length, 2);
  assert.equal(result.recaudacionARS, 1500);
  assert.equal(result.comparacion.recaudacionARS, 1000);
  assert.equal(result.comparacion.periodoAplicado, "el mes pasado");
  assert.deepEqual(result.variacion.recaudacionARS, { diferencia: 500, porcentaje: 50 });
  assert.deepEqual(result.variacion.entradasPagas, { diferencia: 50, porcentaje: 50 });
});

test("sin comparación no hay campos de comparación", async () => {
  const { runContext } = makeContext();
  const result = parse(await call(runContext, { compararCon: null }));

  assert.equal("comparacion" in result, false);
  assert.equal("variacion" in result, false);
});

test("el timeout de mes_pasado vuelve al modelo con una alternativa", async () => {
  // Excepción deliberada: date=last_month da 504 en cuentas grandes y es el
  // único caso donde el modelo tiene una acción alternativa válida.
  const { runContext } = makeContext({
    fetchStats: async () => {
      throw new ReportTimeoutError();
    },
  });

  const output = await call(runContext, { periodoDeVenta: "mes_pasado" });

  assert.equal(typeof output, "string");
  assert.match(output, /mes_pasado no está disponible/);
  assert.match(output, /este_mes/);
});

test("un timeout en cualquier otro período sí termina la petición", async () => {
  const { runContext } = makeContext({
    fetchStats: async () => {
      throw new ReportTimeoutError();
    },
  });

  await assert.rejects(
    () => call(runContext, { periodoDeVenta: "este_mes" }),
    ReportTimeoutError,
  );
});

test("un fallo del backend sube: el modelo no puede corregir eso", async () => {
  const { runContext } = makeContext({
    fetchStats: async () => {
      throw new ReportApiError(500, "backend caido");
    },
  });

  await assert.rejects(() => call(runContext, {}), ReportApiError);
});

test("una cuenta sin eventos falla con mensaje recuperable, sin pegarle al backend", async () => {
  const { runContext, llamadas } = makeContext({ funciones: [] });

  const output = await call(runContext, { refs: null });

  assert.equal(llamadas.length, 0);
  assert.match(String(output), /no tiene eventos/);
});

test("el audit registra el alcance y el período, nunca importes", async () => {
  const { runContext, audit } = makeContext();

  await call(runContext, { refs: [refDe("Festival")], periodoDeVenta: "este_mes" });

  const registro = audit.find((entry) => entry.toolName === "resumen_de_ventas");
  assert.equal(registro.parameters.alcance, "Festival");
  assert.equal(registro.parameters.periodoAplicado, "este mes");
  assert.equal(registro.parameters.funciones, 1);
  // Ningún importe entra al log: los parámetros son refs y períodos.
  assert.equal(JSON.stringify(registro).includes("500000"), false);
  assert.equal(JSON.stringify(registro).includes("recaudacion"), false);
});

test("ningún nombre crudo del backend sale en la respuesta de la tool", async () => {
  const { runContext } = makeContext();
  const result = parse(await call(runContext, {}));
  const claves = Object.keys(result);

  for (const crudo of ["total", "tickets", "invitations", "total_tickets", "unique_buyers"]) {
    assert.equal(claves.includes(crudo), false, `se filtró ${crudo}`);
  }
  assert.equal(JSON.stringify(result).includes("chart"), false);
});
