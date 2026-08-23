import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import {
  compareEvents,
  comparePeriods,
  getEventStats,
  listEvents,
} from "./eventData.mjs";

const periodSchema = z.enum(["this_week", "last_week"]);

export const createTuentradaAgent = ({ ownerId, audit = () => {} }) => {
  const listEventsTool = tool({
    name: "listar_eventos",
    description: "Lista los eventos accesibles para el usuario autenticado.",
    parameters: z.object({}),
    execute: async () => {
      audit("listar_eventos", {});
      return listEvents(ownerId);
    },
  });

  const getStatsTool = tool({
    name: "obtener_estadisticas",
    description:
      "Obtiene entradas vendidas y recaudación de un evento y período concretos.",
    parameters: z.object({
      evento: z.string().describe("Nombre del evento"),
      periodo: periodSchema,
    }),
    execute: async ({ evento, periodo }) => {
      audit("obtener_estadisticas", { evento, periodo });
      return getEventStats(ownerId, evento, periodo);
    },
  });

  const compareEventsTool = tool({
    name: "comparar_eventos",
    description:
      "Compara de forma determinista entradas y recaudación de dos eventos en el mismo período.",
    parameters: z.object({
      eventoA: z.string(),
      eventoB: z.string(),
      periodo: periodSchema,
    }),
    execute: async ({ eventoA, eventoB, periodo }) => {
      audit("comparar_eventos", { eventoA, eventoB, periodo });
      return compareEvents(ownerId, eventoA, eventoB, periodo);
    },
  });

  const comparePeriodsTool = tool({
    name: "comparar_periodos",
    description:
      "Compara esta semana contra la semana pasada para un evento y calcula las variaciones.",
    parameters: z.object({ evento: z.string() }),
    execute: async ({ evento }) => {
      audit("comparar_periodos", { evento });
      return comparePeriods(ownerId, evento);
    },
  });

  return new Agent({
    name: "Analista de Tuentrada",
    model: process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra",
    instructions: `
Sos un analista de ventas de eventos de Tuentrada.

Objetivo: responder en español rioplatense preguntas sobre los eventos del usuario autenticado.

Reglas:
- Usá las herramientas para toda afirmación sobre eventos, entradas o dinero.
- Nunca inventes eventos, cifras ni causas.
- Los cálculos comparativos provienen de las herramientas; no los recalcules.
- Si falta el nombre de un evento o el período, pedí solamente ese dato.
- No afirmes que no hay datos hasta haber consultado la herramienta adecuada.
- Respondé con una conclusión breve y las cifras que la respaldan.
`,
    tools: [listEventsTool, getStatsTool, compareEventsTool, comparePeriodsTool],
  });
};

export const runLiveAgent = async (question, options) => {
  const agent = createTuentradaAgent(options);
  const result = await run(agent, question, {
    maxTurns: 6,
    workflowName: "Tuentrada agent lab",
  });
  return result.finalOutput;
};
