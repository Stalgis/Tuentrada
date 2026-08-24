import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

const requireAppContext = (runContext) => {
  if (!runContext?.context) {
    throw new Error("El agente se ejecutó sin contexto autenticado.");
  }
  return runContext.context;
};

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

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
  }),
  errorFunction: null,
  execute: async ({ consulta, limite }, runContext) => {
    const { reports, audit } = requireAppContext(runContext);
    audit("buscar_eventos", { consulta, limite });
    const events = await reports.listEvents();
    const filtered = consulta
      ? events.filter((event) => normalize(event.name).includes(normalize(consulta)))
      : events;

    return {
      totalAccessible: events.length,
      totalMatches: filtered.length,
      truncated: filtered.length > limite,
      events: filtered.slice(0, limite).map(({ name, dateISO, status }) => ({
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
