import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { resolveEventDateRange } from "./eventDateRanges.mjs";
import { searchEventCatalog } from "./eventSearch.mjs";

const requireAppContext = (runContext) => {
  if (!runContext?.context) {
    throw new Error("El agente se ejecutó sin contexto autenticado.");
  }
  return runContext.context;
};

const searchEventsTool = tool({
  name: "buscar_eventos",
  description:
    "Busca o lista eventos reales accesibles para el usuario autenticado. Usar antes de afirmar nombres, cantidad o fechas de eventos.",
  parameters: z.object({
    consulta: z
      .string()
      .max(100)
      .nullable()
      .describe("Texto opcional para filtrar por nombre; null para listar todos"),
    limite: z.number().int().min(1).max(30),
    periodo: z
      .enum([
        "todos",
        "hoy",
        "manana",
        "esta_semana",
        "semana_pasada",
        "proxima_semana",
        "este_mes",
        "personalizado",
      ])
      .nullable()
      .describe("Período relativo solicitado; null o todos cuando no hay filtro temporal"),
    fechaDesde: z
      .string()
      .nullable()
      .describe("Inicio YYYY-MM-DD sólo cuando periodo es personalizado; null en otro caso"),
    fechaHasta: z
      .string()
      .nullable()
      .describe("Fin YYYY-MM-DD sólo cuando periodo es personalizado; null en otro caso"),
  }),
  errorFunction: null,
  execute: async (
    { consulta, limite, periodo, fechaDesde, fechaHasta },
    runContext,
  ) => {
    const { reports, audit, now } = requireAppContext(runContext);
    const range = resolveEventDateRange({
      periodo,
      fechaDesde,
      fechaHasta,
      now,
    });
    audit("buscar_eventos", {
      consulta,
      limite,
      periodo,
      fechaDesde,
      fechaHasta,
      rangoResuelto: range,
    });
    const events = await reports.listEvents();
    const result = searchEventCatalog({ events, consulta, range, limite });

    return {
      totalAccessible: result.totalAccessible,
      totalMatches: result.totalMatches,
      truncated: result.truncated,
      dateRange: range,
      events: result.events.map(({ name, dateISO, status }) => ({
        name,
        dateISO,
        status,
      })),
    };
  },
});

export const tuentradaAgent = new Agent({
  name: "Analista de Tuentrada",
  model: process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra",
  instructions: `
Sos el analista de eventos de Tuentrada en una prueba limitada con datos reales.

Objetivo: ayudar al usuario a encontrar y contar sus eventos accesibles.

Reglas:
- Usá buscar_eventos antes de afirmar nombres, cantidades, estados o fechas.
- Cuando pidan hoy, mañana, esta semana, la semana pasada, la próxima semana o este mes, pasá ese período a buscar_eventos. La herramienta calcula las fechas en hora de Argentina.
- Para un rango con fechas explícitas usá periodo personalizado y completá fechaDesde y fechaHasta en formato YYYY-MM-DD.
- Aplicá el filtro temporal en la herramienta; nunca deduzcas qué eventos pertenecen al período mirando una lista sin filtrar.
- Sólo podés responder sobre el catálogo de eventos. Estadísticas, ventas, pagos, sectores y comparaciones todavía no están habilitados.
- Si piden una capacidad no habilitada, explicalo brevemente y ofrecé listar o buscar eventos.
- Nunca inventes eventos ni completes nombres o fechas ausentes.
- Si el resultado está truncado, decilo.
- Respondé en español rioplatense y de forma breve.
`,
  tools: [searchEventsTool],
});

export const answerWithAgent = async ({ message, user, reports, signal }) => {
  const toolCalls = [];
  const result = await run(tuentradaAgent, message, {
    context: {
      user,
      reports,
      now: new Date(),
      audit: (toolName, parameters) => toolCalls.push({ toolName, parameters }),
    },
    maxTurns: 4,
    signal,
    workflowName: "Tuentrada real-data catalog test",
  });

  return {
    answer: result.finalOutput,
    toolCalls,
  };
};
