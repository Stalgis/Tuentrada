import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { salesHistoryTool } from "../server/agent-service/agent.mjs";
import { createDemoAuthenticator } from "../server/agent-service/auth.mjs";
import { createAgentHttpServer } from "../server/agent-service/httpServer.mjs";
import {
  ReportApiError,
  ReportAuthenticationError,
  ReportTimeoutError,
  UpstreamBudgetError,
} from "../server/agent-service/reportApiClient.mjs";
import { AgentOutputError, AgentTurnLimitError } from "../server/agent-service/agent.mjs";

test("todo error que puede escapar de una tool lleva httpStatus y mensaje publico", () => {
  // Sin esto cae al catch-all del httpServer y sale como 500 generico: el
  // usuario no sabe que paso y, en el caso de la sesion vencida, la app ni
  // siquiera lo saca a login.
  const errores = [
    [new ReportAuthenticationError(), 401],
    [new ReportApiError(500, "x"), 502],
    [new ReportTimeoutError(), 504],
    [new UpstreamBudgetError(25), 503],
    [new AgentOutputError("x"), 502],
    [new AgentTurnLimitError(6), 502],
  ];

  for (const [error, status] of errores) {
    assert.equal(error.httpStatus, status, `${error.name} sin httpStatus correcto`);
    assert.ok(
      typeof error.publicMessage === "string" && error.publicMessage.length > 10,
      `${error.name} sin publicMessage util`,
    );
  }
});

const contexto = (fetchHistory) => ({
  context: {
    user: { id: "session-fp" },
    now: new Date("2026-08-25T18:00:00-03:00"),
    audit: () => {},
    reports: {
      listEvents: async () => [
        { id: "1", name: "Evento", fecha: "2026-09-01", dateISO: "2026-09-01T21:00:00-03:00", yaOcurrio: false },
      ],
      fetchHistory,
    },
  },
});

const consultar = (runContext) =>
  salesHistoryTool.invoke(
    runContext,
    JSON.stringify({ refs: null, periodoDeVenta: "este_mes", ventasDesde: null, ventasHasta: null }),
  );

test("un timeout dentro de una tool sale como 504, no como 500 generico", async () => {
  // Era el fallo real de "que dia vendi mas este mes": /history sobre cientos
  // de funciones se pasaba del timeout y el usuario veia "No se pudo procesar
  // la consulta".
  await assert.rejects(
    () => consultar(contexto(async () => { throw new ReportTimeoutError(); })),
    (error) => {
      assert.equal(error.httpStatus, 504);
      assert.match(error.publicMessage, /acotando la consulta/);
      return true;
    },
  );
});

test("un 401 dentro de una tool sale como 401, para que la app cierre sesion", async () => {
  await assert.rejects(
    () => consultar(contexto(async () => { throw new ReportAuthenticationError(); })),
    (error) => {
      assert.equal(error.httpStatus, 401);
      return true;
    },
  );
});

test("el httpServer traduce esos errores en vez de esconderlos en un 500", async (t) => {
  const casos = [
    [new ReportTimeoutError(), 504, /acotando la consulta/],
    [new ReportAuthenticationError(), 401, /sesión venció/],
    [new UpstreamBudgetError(25), 503, /más acotada/],
  ];

  for (const [error, status, mensaje] of casos) {
    const server = createAgentHttpServer({
      authenticate: createDemoAuthenticator({ expectedToken: "t", reports: {} }),
      answerQuestion: async () => {
        throw error;
      },
      logger: { error: () => {}, log: () => {} },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => server.close());

    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/chat`, {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hola" }),
    });

    assert.equal(response.status, status, `${error.name} salio con status equivocado`);
    assert.match((await response.json()).error, mensaje);
  }
});

test("el timeout del agente sigue siendo mayor que el del backend", async () => {
  // Si el upstream pudiera consumir el presupuesto entero, el timeout total
  // declarado seria mentira. index.mjs se niega a arrancar si se invierte.
  const { readFile } = await import("node:fs/promises");
  const index = await readFile(
    new URL("../server/agent-service/index.mjs", import.meta.url),
    "utf8",
  );

  const total = Number(index.match(/AGENT_REQUEST_TIMEOUT_MS", ([\d_]+)/)[1].replace(/_/g, ""));
  const upstream = Number(index.match(/REPORT_API_TIMEOUT_MS", ([\d_]+)/)[1].replace(/_/g, ""));

  assert.ok(upstream < total, `upstream ${upstream} deberia ser menor que total ${total}`);
  assert.ok(upstream >= 20_000, "no puede ser menor que el timeout del cliente de la app");
});
