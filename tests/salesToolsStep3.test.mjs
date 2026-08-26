import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityTool,
  paymentMethodsTool,
  salesHistoryTool,
} from "../server/agent-service/agent.mjs";
import { buildEventCatalog } from "../server/agent-service/eventCatalog.mjs";
import { ReportTimeoutError } from "../server/agent-service/reportApiClient.mjs";

const funcion = (id, name, fecha) => ({
  id,
  name,
  fecha,
  dateISO: `${fecha}T21:00:00-03:00`,
  yaOcurrio: false,
});

const FUNCIONES = [
  funcion("11", "Unipersonal", "2026-09-01"),
  funcion("12", "Unipersonal", "2026-09-02"),
  funcion("99", "Festival", "2026-10-01"),
];

const refDe = (funciones, nombre) =>
  buildEventCatalog(funciones).eventos.find((evento) => evento.nombre === nombre).ref;

const makeContext = ({ funciones = FUNCIONES, ...handlers } = {}) => {
  const llamadas = [];
  const audit = [];
  const limites = [];
  return {
    llamadas,
    audit,
    limites,
    runContext: {
      context: {
        user: { id: "session-fp" },
        now: new Date("2026-08-25T18:00:00-03:00"),
        audit: (toolName, parameters) => audit.push({ toolName, parameters }),
        registrarLimite: (tipo, detalle) => limites.push({ tipo, ...detalle }),
        reports: {
          listEvents: async () => funciones,
          fetchHistory: async (ids, period) => {
            llamadas.push({ recurso: "history", ids, period });
            return handlers.fetchHistory
              ? handlers.fetchHistory(ids, period)
              : [
                  { day_date: "2026-08-01", day_formatted: "01/08", sold_tickets: 10, sold_guest: 1, total_tickets: 11, total_net: 1000 },
                  { day_date: "2026-08-02", day_formatted: "02/08", sold_tickets: 30, sold_guest: 0, total_tickets: 30, total_net: 5000 },
                  { day_date: "", day_formatted: "TOTAL", sold_tickets: 40, sold_guest: 1, total_tickets: 41, total_net: 6000 },
                ];
          },
          fetchPayments: async (ids, period) => {
            llamadas.push({ recurso: "payments", ids, period });
            return handlers.fetchPayments
              ? handlers.fetchPayments(ids, period)
              : [
                  { payment_name: "Efectivo", sold_tickets: 10, total_revenue: "250000" },
                  { payment_name: "Tarjeta", sold_tickets: 30, total_revenue: 750000 },
                ];
          },
          fetchOnlineSales: async (id) => {
            llamadas.push({ recurso: "online-sales", id });
            return handlers.fetchOnlineSales
              ? handlers.fetchOnlineSales(id)
              : [
                  { price_type: "Platea", total: 100, available: 40, purchase: 55, invitation: 5, kill: 0, promoter_blocked: 0 },
                ];
          },
        },
      },
    },
  };
};

const parse = (output) => (typeof output === "string" ? JSON.parse(output) : output);
const alcanceBase = { refs: null, periodoDeVenta: "todo", ventasDesde: null, ventasHasta: null };

// ─── evolucion_de_ventas ─────────────────────────────────────────────────────

test("evolucion: la fila TOTAL no queda como un día más", async () => {
  const { runContext } = makeContext();
  const result = parse(
    await salesHistoryTool.invoke(runContext, JSON.stringify({ ...alcanceBase, periodoDeVenta: "este_mes" })),
  );

  assert.equal(result.dias.length, 2);
  assert.equal(result.total.recaudacionARS, 6000);
  assert.equal(result.periodoAplicado, "este mes");
  assert.equal(result.alcance, "toda la cuenta");
});

test("evolucion: el mejor día viene elegido por el código", async () => {
  const { runContext } = makeContext();
  const result = parse(await salesHistoryTool.invoke(runContext, JSON.stringify(alcanceBase)));

  assert.equal(result.mejorDia.fecha, "2026-08-02");
  assert.equal(result.mejorDia.recaudacionARS, 5000);
});

test("evolucion: con un ref consulta sólo ese evento", async () => {
  const { runContext, llamadas } = makeContext();
  await salesHistoryTool.invoke(
    runContext,
    JSON.stringify({ ...alcanceBase, refs: [refDe(FUNCIONES, "Unipersonal")] }),
  );

  assert.deepEqual(llamadas[0].ids, ["11", "12"]);
});

test("evolucion: el timeout de mes_pasado vuelve al modelo con alternativa", async () => {
  const { runContext } = makeContext({
    fetchHistory: () => {
      throw new ReportTimeoutError();
    },
  });

  const output = await salesHistoryTool.invoke(
    runContext,
    JSON.stringify({ ...alcanceBase, periodoDeVenta: "mes_pasado" }),
  );

  assert.match(String(output), /mes_pasado no está disponible/);
});

// ─── medios_de_pago ──────────────────────────────────────────────────────────

test("medios de pago: ordena y calcula el porcentaje", async () => {
  const { runContext } = makeContext();
  const result = parse(
    await paymentMethodsTool.invoke(runContext, JSON.stringify({ ...alcanceBase, periodoDeVenta: "esta_semana" })),
  );

  assert.equal(result.medios[0].medio, "Tarjeta");
  assert.equal(result.medios[0].porcentajeDeRecaudacion, 75);
  assert.equal(result.recaudacionTotalARS, 1_000_000);
  assert.equal(result.periodoAplicado, "esta semana");
});

test("medios de pago: un ref inventado no llega al backend", async () => {
  const { runContext, llamadas } = makeContext();
  const output = await paymentMethodsTool.invoke(
    runContext,
    JSON.stringify({ ...alcanceBase, refs: ["ev_deadbeef"] }),
  );

  assert.equal(llamadas.length, 0);
  assert.match(String(output), /no existen en el catálogo/);
});

// ─── disponibilidad ──────────────────────────────────────────────────────────

test("disponibilidad: una llamada por función y suma por sector", async () => {
  const { runContext, llamadas } = makeContext();
  const result = parse(
    await availabilityTool.invoke(
      runContext,
      JSON.stringify({ ref: refDe(FUNCIONES, "Unipersonal") }),
    ),
  );

  assert.deepEqual(
    llamadas.map((l) => l.id),
    ["11", "12"],
  );
  assert.equal(result.alcance, "Unipersonal");
  assert.equal(result.funcionesIncluidas, 2);
  assert.equal(result.total.localidades, 200);
  assert.equal(result.total.disponibles, 80);
  assert.equal(result.sectores[0].sector, "Platea");
});

test("disponibilidad: rechaza un evento con demasiadas funciones, sin pegarle al backend", async () => {
  // Es lo que evita que esta tool reabra el fan-out que el resto del diseño esquiva.
  const muchas = Array.from({ length: 13 }, (_, index) =>
    funcion(String(500 + index), "Temporada Larga", `2026-09-${String(index + 1).padStart(2, "0")}`),
  );
  const { runContext, llamadas, limites } = makeContext({ funciones: muchas });

  const output = await availabilityTool.invoke(
    runContext,
    JSON.stringify({ ref: refDe(muchas, "Temporada Larga") }),
  );

  assert.equal(llamadas.length, 0);
  assert.match(String(output), /13 funciones/);
  assert.match(String(output), /12 como máximo/);

  // Queda registrado en su propio canal: es la evidencia para decidir si el
  // tope molesta lo suficiente como para construir el snapshot de la fase 2.
  assert.deepEqual(limites, [
    {
      tipo: "funciones_disponibilidad",
      evento: "Temporada Larga",
      funciones: 13,
      tope: 12,
    },
  ]);
});

test("disponibilidad: dentro del tope no registra nada", async () => {
  const { runContext, limites } = makeContext();
  await availabilityTool.invoke(
    runContext,
    JSON.stringify({ ref: refDe(FUNCIONES, "Unipersonal") }),
  );

  assert.deepEqual(limites, []);
});

test("disponibilidad: justo en el tope sí consulta", async () => {
  const doce = Array.from({ length: 12 }, (_, index) =>
    funcion(String(600 + index), "Temporada", `2026-09-${String(index + 1).padStart(2, "0")}`),
  );
  const { runContext, llamadas } = makeContext({ funciones: doce });

  const result = parse(
    await availabilityTool.invoke(runContext, JSON.stringify({ ref: refDe(doce, "Temporada") })),
  );

  assert.equal(llamadas.length, 12);
  assert.equal(result.funcionesIncluidas, 12);
});

test("disponibilidad: un ref inventado no llega al backend", async () => {
  const { runContext, llamadas } = makeContext();
  const output = await availabilityTool.invoke(runContext, JSON.stringify({ ref: "ev_deadbeef" }));

  assert.equal(llamadas.length, 0);
  assert.match(String(output), /no existen en el catálogo/);
});

test("disponibilidad: el audit no registra importes", async () => {
  const { runContext, audit } = makeContext();
  await availabilityTool.invoke(
    runContext,
    JSON.stringify({ ref: refDe(FUNCIONES, "Festival") }),
  );

  const registro = audit.find((entry) => entry.toolName === "disponibilidad");
  assert.equal(registro.parameters.alcance, "Festival");
  assert.equal(registro.parameters.funciones, 1);
  assert.equal(JSON.stringify(registro).includes("localidades"), false);
});
