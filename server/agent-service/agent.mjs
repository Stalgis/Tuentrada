import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

const periodSchema = z.enum(["this_week", "last_week"]);

const requireAppContext = (runContext) => {
  if (!runContext?.context) {
    throw new Error("El agente se ejecutó sin contexto autenticado.");
  }
  return runContext.context;
};

const listEventsTool = tool({
  name: "listar_eventos",
  description: "Lista los eventos accesibles para el usuario autenticado.",
  parameters: z.object({}),
  execute: async (_input, runContext) => {
    const { user, reports, audit } = requireAppContext(runContext);
    audit("listar_eventos", {});
    return reports.listEvents(user.id);
  },
});

const getStatsTool = tool({
  name: "obtener_estadisticas",
  description:
    "Obtiene entradas vendidas y recaudación de un evento en un período concreto.",
  parameters: z.object({
    evento: z.string().min(1).describe("Nombre del evento"),
    periodo: periodSchema,
  }),
  execute: async ({ evento, periodo }, runContext) => {
    const { user, reports, audit } = requireAppContext(runContext);
    audit("obtener_estadisticas", { evento, periodo });
    return reports.getEventStats(user.id, evento, periodo);
  },
});

const compareEventsTool = tool({
  name: "comparar_eventos",
  description:
    "Compara entradas y recaudación de dos eventos accesibles en el mismo período.",
  parameters: z.object({
    eventoA: z.string().min(1),
    eventoB: z.string().min(1),
    periodo: periodSchema,
  }),
  execute: async ({ eventoA, eventoB, periodo }, runContext) => {
    const { user, reports, audit } = requireAppContext(runContext);
    audit("comparar_eventos", { eventoA, eventoB, periodo });
    return reports.compareEvents(user.id, eventoA, eventoB, periodo);
  },
});

const comparePeriodsTool = tool({
  name: "comparar_periodos",
  description:
    "Compara esta semana contra la anterior para un evento y devuelve variaciones calculadas.",
  parameters: z.object({ evento: z.string().min(1) }),
  execute: async ({ evento }, runContext) => {
    const { user, reports, audit } = requireAppContext(runContext);
    audit("comparar_periodos", { evento });
    return reports.comparePeriods(user.id, evento);
  },
});

export const tuentradaAgent = new Agent({
  name: "Analista de Tuentrada",
  model: process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra",
  instructions: `
Sos el analista de ventas de eventos de Tuentrada.

Objetivo: responder en español rioplatense preguntas sobre los eventos del usuario autenticado.

Reglas:
- Usá herramientas para toda afirmación sobre eventos, entradas o dinero.
- Nunca inventes eventos, cifras, tendencias ni causas.
- Conservá los cálculos entregados por las herramientas; no los recalcules.
- Si falta un dato indispensable, pedí únicamente ese dato.
- Respondé primero con la conclusión y después con las cifras que la respaldan.
`,
  tools: [listEventsTool, getStatsTool, compareEventsTool, comparePeriodsTool],
});

export const answerWithAgent = async ({ message, user, reports, signal }) => {
  const toolCalls = [];
  const result = await run(tuentradaAgent, message, {
    context: {
      user,
      reports,
      audit: (toolName, parameters) => toolCalls.push({ toolName, parameters }),
    },
    maxTurns: 6,
    signal,
    workflowName: "Tuentrada agent service",
  });

  return {
    answer: result.finalOutput,
    toolCalls,
  };
};
