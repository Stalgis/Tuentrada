import { Agent, MaxTurnsExceededError, run, tool } from "@openai/agents";
import { z } from "zod";
import {
  PERIODOS,
  resolveEventDateRange,
  todayInArgentina,
  weekdayInArgentina,
} from "./eventDateRanges.mjs";
import {
  allFunctionIds,
  buildEventCatalog,
  resolveEventRefs,
} from "./eventCatalog.mjs";
import { searchEventCatalog } from "./eventSearch.mjs";
import { ReportTimeoutError } from "./reportApiClient.mjs";
import { aggregateAvailability } from "./availability.mjs";
import { toPaymentMethods } from "./paymentMethods.mjs";
import { toSalesHistory } from "./salesHistory.mjs";
import { PERIODOS_DE_VENTA, resolveSalesPeriod } from "./salesPeriods.mjs";
import { compararResumenes, toSalesSummary } from "./salesSummary.mjs";
import { ToolInputError } from "./toolErrors.mjs";

/**
 * Turnos máximos de un run.
 *
 * Con cinco herramientas una pregunta compuesta ("cómo vengo este mes y con qué
 * se paga") necesita fácil tres o cuatro turnos, y con cuatro se cortaba antes
 * de responder. Seis da margen sin volverse un cheque en blanco: el techo real
 * del costo lo pone el presupuesto de consultas al backend, que es por
 * petición y no por turno.
 */
const DEFAULT_MAX_TURNS = Number(process.env.AGENT_MAX_TURNS) || 6;

export class AgentTurnLimitError extends Error {
  constructor(maxTurns) {
    super(`El agente agotó sus ${maxTurns} turnos sin llegar a una respuesta.`);
    this.name = "AgentTurnLimitError";
    this.httpStatus = 502;
    this.publicMessage =
      "La consulta resultó demasiado compleja de resolver. Probá preguntando una cosa por vez.";
  }
}

export class AgentOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = "AgentOutputError";
    this.httpStatus = 502;
    this.publicMessage = "El agente no pudo generar una respuesta. Probá de nuevo.";
  }
}

const requireAppContext = (runContext) => {
  if (!runContext?.context) {
    throw new Error("El agente se ejecutó sin contexto autenticado.");
  }
  return runContext.context;
};

const horaDelEvento = (dateISO) => (dateISO ? dateISO.slice(11, 16) : null);

/**
 * Hora de la primera función con fecha. Se manda sólo cuando el evento tiene
 * una sola función: con varias, una hora suelta es más confusa que útil.
 */
const horaDePrimeraFuncion = (evento) => {
  if (evento.funciones.length !== 1) return null;
  return horaDelEvento(evento.funciones[0].dateISO);
};

/**
 * Los errores de parámetros vuelven al modelo como texto para que corrija y
 * reintente (hay margen dentro de maxTurns). Cualquier otro error sube y
 * termina la petición: un modelo no puede "corregir" que el backend esté
 * caído, y reintentar contra un backend muerto sólo quema turnos y plata.
 */
const errorFunctionRecuperable = (nombreTool) => (runContext, error) => {
  if (error instanceof ToolInputError) {
    runContext?.context?.audit?.(`${nombreTool}:error_parametros`, {
      mensaje: error.message,
    });
    return `Error en los parámetros: ${error.message} Corregilos y volvé a llamar la herramienta.`;
  }
  throw error;
};

export const searchEventsTool = tool({
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
      .enum(PERIODOS)
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

  errorFunction: errorFunctionRecuperable("buscar_eventos"),

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
    const funciones = await reports.listEvents();
    // El backend devuelve una fila por función; el modelo sólo ve eventos.
    const catalog = buildEventCatalog(funciones);
    const result = searchEventCatalog({
      eventos: catalog.eventos,
      consulta,
      range,
      limite,
    });

    return {
      totalAccessible: result.totalAccessible,
      totalMatches: result.totalMatches,
      sinFecha: result.sinFecha,
      truncated: result.truncated,
      dateRange: range,
      eventos: result.matches.map(({ evento, funcionesEnRango }) => ({
        ref: evento.ref,
        nombre: evento.nombre,
        funciones: evento.funciones.length,
        ...(range ? { funcionesEnRango } : {}),
        primeraFecha: evento.primeraFecha || null,
        ultimaFecha: evento.ultimaFecha || null,
        hora: horaDePrimeraFuncion(evento),
        yaOcurrio: evento.yaOcurrio,
      })),
    };
  },
});


/**
 * Resuelve el alcance a ids de función. `refs` en null significa toda la cuenta.
 * El modelo nunca ve ni manda ids: sólo refs que salieron de buscar_eventos.
 */
const resolverAlcance = async (reports, refs) => {
  const catalog = buildEventCatalog(await reports.listEvents());

  if (refs === null) {
    const funcionIds = allFunctionIds(catalog);
    if (funcionIds.length === 0) {
      throw new ToolInputError("La cuenta no tiene eventos con datos consultables.");
    }
    return { funcionIds, alcance: "toda la cuenta", eventos: catalog.eventos };
  }

  const { eventos, funcionIds } = resolveEventRefs(catalog, refs);
  if (funcionIds.length === 0) {
    throw new ToolInputError(
      "Esos eventos no tienen funciones con datos consultables.",
    );
  }
  return {
    funcionIds,
    alcance: eventos.map((evento) => evento.nombre).join(", "),
    eventos,
  };
};

/**
 * `date=last_month` da 504 en cuentas grandes. Es un bug de backend conocido que
 * ya rompe "Ingresos del mes" en la app.
 *
 * Excepción deliberada al criterio de errores: acá un timeout se convierte en
 * mensaje para el modelo en vez de terminar la petición, porque es el único
 * caso donde el modelo tiene una alternativa válida que ofrecer. Cualquier otro
 * período con timeout sigue subiendo como 504.
 */
const pedirReporte = async (consultar, periodoDeVenta) => {
  try {
    return await consultar();
  } catch (error) {
    if (error instanceof ReportTimeoutError && periodoDeVenta === "mes_pasado") {
      throw new ToolInputError(
        "El período mes_pasado no está disponible en este momento por una limitación del backend. Ofrecele al usuario este_mes, o un rango personalizado con las fechas del mes pasado.",
      );
    }
    throw error;
  }
};

/** Alcance y período de venta: los comparten las tres tools de ventas. */
const PARAMETROS_DE_ALCANCE = {
  refs: z
    .array(z.string())
    .nullable()
    .describe("refs devueltos por buscar_eventos; null para toda la cuenta"),
  periodoDeVenta: z
    .enum(PERIODOS_DE_VENTA)
    .describe("Cuándo se hizo la venta. No es la fecha del evento."),
  ventasDesde: z
    .string()
    .nullable()
    .describe("Inicio YYYY-MM-DD sólo cuando periodoDeVenta es personalizado; null en otro caso"),
  ventasHasta: z
    .string()
    .nullable()
    .describe("Fin YYYY-MM-DD sólo cuando periodoDeVenta es personalizado; null en otro caso"),
};

export const salesSummaryTool = tool({
  name: "resumen_de_ventas",
  description:
    "Totales de venta (entradas, recaudación, compradores) de toda la cuenta o de eventos puntuales, en un período de venta. Usar buscar_eventos primero para obtener los refs.",
  parameters: z.object({
    ...PARAMETROS_DE_ALCANCE,
    compararCon: z
      .enum(PERIODOS_DE_VENTA)
      .nullable()
      .describe("Período de venta contra el cual comparar; null si no se pide comparación"),
  }),

  errorFunction: errorFunctionRecuperable("resumen_de_ventas"),

  execute: async (
    { refs, periodoDeVenta, ventasDesde, ventasHasta, compararCon },
    runContext,
  ) => {
    const { reports, audit, now } = requireAppContext(runContext);

    const period = resolveSalesPeriod({ periodoDeVenta, ventasDesde, ventasHasta, now });
    const periodPrevio = compararCon
      ? resolveSalesPeriod({ periodoDeVenta: compararCon, now })
      : null;

    const { funcionIds, alcance } = await resolverAlcance(reports, refs);

    audit("resumen_de_ventas", {
      refs,
      periodoDeVenta,
      compararCon,
      alcance,
      funciones: funcionIds.length,
      periodoAplicado: period.etiqueta,
    });

    // Las dos consultas salen juntas: comparar no debe costar el doble de
    // espera dentro del presupuesto de la petición.
    const [statsActual, statsPrevio] = await Promise.all([
      pedirReporte(() => reports.fetchStats(funcionIds, period), periodoDeVenta),
      periodPrevio
        ? pedirReporte(() => reports.fetchStats(funcionIds, periodPrevio), compararCon)
        : Promise.resolve(null),
    ]);

    const resumen = toSalesSummary(statsActual);

    return {
      alcance,
      funcionesIncluidas: funcionIds.length,
      periodoAplicado: period.etiqueta,
      ...resumen,
      ...(statsPrevio
        ? {
            comparacion: {
              periodoAplicado: periodPrevio.etiqueta,
              ...toSalesSummary(statsPrevio),
            },
            // Calculada en código: el modelo no hace aritmética sobre plata.
            variacion: compararResumenes(resumen, toSalesSummary(statsPrevio)),
          }
        : {}),
    };
  },
});


export const salesHistoryTool = tool({
  name: "evolucion_de_ventas",
  description:
    "Serie diaria de ventas: cuánto se vendió cada día en un período. Sirve para ver tendencia, el mejor día o si las ventas se frenaron.",
  parameters: z.object(PARAMETROS_DE_ALCANCE),

  errorFunction: errorFunctionRecuperable("evolucion_de_ventas"),

  execute: async ({ refs, periodoDeVenta, ventasDesde, ventasHasta }, runContext) => {
    const { reports, audit, now } = requireAppContext(runContext);

    const period = resolveSalesPeriod({ periodoDeVenta, ventasDesde, ventasHasta, now });
    const { funcionIds, alcance } = await resolverAlcance(reports, refs);

    audit("evolucion_de_ventas", {
      refs,
      periodoDeVenta,
      alcance,
      funciones: funcionIds.length,
      periodoAplicado: period.etiqueta,
    });

    const historia = toSalesHistory(
      await pedirReporte(() => reports.fetchHistory(funcionIds, period), periodoDeVenta),
    );

    return {
      alcance,
      funcionesIncluidas: funcionIds.length,
      periodoAplicado: period.etiqueta,
      ...historia,
    };
  },
});

export const paymentMethodsTool = tool({
  name: "medios_de_pago",
  description:
    "Desglose de la recaudación por medio de pago (tarjeta, efectivo, transferencia y demás) en un período de venta.",
  parameters: z.object(PARAMETROS_DE_ALCANCE),

  errorFunction: errorFunctionRecuperable("medios_de_pago"),

  execute: async ({ refs, periodoDeVenta, ventasDesde, ventasHasta }, runContext) => {
    const { reports, audit, now } = requireAppContext(runContext);

    const period = resolveSalesPeriod({ periodoDeVenta, ventasDesde, ventasHasta, now });
    const { funcionIds, alcance } = await resolverAlcance(reports, refs);

    audit("medios_de_pago", {
      refs,
      periodoDeVenta,
      alcance,
      funciones: funcionIds.length,
      periodoAplicado: period.etiqueta,
    });

    return {
      alcance,
      funcionesIncluidas: funcionIds.length,
      periodoAplicado: period.etiqueta,
      ...toPaymentMethods(
        await pedirReporte(() => reports.fetchPayments(funcionIds, period), periodoDeVenta),
      ),
    };
  },
});

/**
 * Tope de funciones para disponibilidad.
 *
 * online-sales es el único endpoint sin forma de lote: una llamada por función.
 * El tope es lo que evita que esta tool reabra el fan-out que el resto del
 * diseño esquiva, y mantiene el costo acotado dentro del presupuesto de la
 * petición.
 */
const MAX_FUNCIONES_DISPONIBILIDAD = 12;

export const availabilityTool = tool({
  name: "disponibilidad",
  description:
    "Cuántas localidades quedan disponibles por sector en UN evento, y cuántas están vendidas, invitadas o bloqueadas. No dice si el evento está activo ni su estado comercial.",
  parameters: z.object({
    ref: z
      .string()
      .describe("ref de un único evento, devuelto por buscar_eventos. No acepta varios ni toda la cuenta."),
  }),

  errorFunction: errorFunctionRecuperable("disponibilidad"),

  execute: async ({ ref }, runContext) => {
    const { reports, audit, registrarLimite } = requireAppContext(runContext);

    const { funcionIds, alcance, eventos } = await resolverAlcance(reports, [ref]);

    if (funcionIds.length > MAX_FUNCIONES_DISPONIBILIDAD) {
      // Canal aparte del audit de tools: es la evidencia para decidir si vale
      // la pena construir el snapshot de la fase 2. Mezclado con los errores de
      // parámetros no se puede contar.
      registrarLimite?.("funciones_disponibilidad", {
        evento: alcance,
        funciones: funcionIds.length,
        tope: MAX_FUNCIONES_DISPONIBILIDAD,
      });
      throw new ToolInputError(
        `"${alcance}" tiene ${funcionIds.length} funciones y la disponibilidad se consulta de a ${MAX_FUNCIONES_DISPONIBILIDAD} como máximo. Decile al usuario que todavía no se puede consultar la disponibilidad de un evento con tantas funciones.`,
      );
    }

    audit("disponibilidad", { ref, alcance, funciones: funcionIds.length });

    // Una llamada por función, todas juntas: el tope de arriba es lo que hace
    // que el paralelo sea seguro.
    const porFuncion = await Promise.all(funcionIds.map((id) => reports.fetchOnlineSales(id)));

    return {
      alcance,
      funcionesIncluidas: funcionIds.length,
      funcionesDelEvento: eventos[0].funciones.length,
      ...aggregateAvailability(porFuncion),
    };
  },
});

/**
 * Las instrucciones se generan por ejecución para poder inyectar la fecha.
 * Como string fijo el modelo no sabe qué día es hoy, y entonces no puede
 * completar `personalizado` sin inventar el año.
 */
export const buildInstructions = (runContext) => {
  const now = runContext?.context?.now ?? new Date();
  return `
Sos el analista de eventos de Tuentrada en una prueba limitada con datos reales.

Contexto temporal: hoy es ${weekdayInArgentina(now)} ${todayInArgentina(now)} en Argentina.

Objetivo: ayudar al usuario a encontrar sus eventos, entender cómo vienen sus ventas y cuánto le queda por vender.

Reglas:
- Usá buscar_eventos antes de afirmar nombres, cantidades, fechas o si un evento ya ocurrió.
- Un evento puede tener varias funciones (varias fechas del mismo espectáculo). buscar_eventos devuelve eventos, no funciones: el campo funciones dice cuántas tiene cada uno. Cuando te pregunten cuántos eventos hay, contá eventos.
- Si un evento tiene varias funciones, nombralo una sola vez y aclará cuántas funciones tiene y entre qué fechas.
- Para períodos relativos usá el parámetro periodo. Están disponibles: hoy, manana, proximos, esta_semana, semana_pasada, proxima_semana, este_mes, mes_pasado, proximo_mes. La herramienta calcula las fechas en hora de Argentina.
- Usá periodo personalizado sólo cuando ninguno de los anteriores sirva, y calculá fechaDesde y fechaHasta en YYYY-MM-DD a partir de la fecha de hoy indicada arriba.
- Un evento entra en el período si al menos una de sus funciones cae adentro; funcionesEnRango dice cuántas son.
- Aplicá el filtro temporal en la herramienta; nunca deduzcas qué eventos pertenecen al período mirando una lista sin filtrar.
- El campo ref es un identificador interno del evento. No lo muestres al usuario ni lo inventes: sirve para pedir datos de ese evento en herramientas futuras.
- El campo yaOcurrio sólo dice si ya pasaron todas las funciones. No sabés si un evento está cancelado, agotado, pausado ni si tiene entradas a la venta: si te lo preguntan, decí que ese dato todavía no está disponible.
- Si sinFecha es mayor que cero, aclaralo: hay eventos sin fecha cargada que no se pudieron incluir en el filtro temporal.

Ventas (resumen_de_ventas):
- Antes de pedir ventas de un evento puntual, llamá buscar_eventos y usá los ref que devuelve. Nunca inventes un ref. Para toda la cuenta, mandá refs en null.
- periodo y periodoDeVenta son cosas distintas. periodo es cuándo OCURRE el evento; periodoDeVenta es cuándo se HIZO la venta. "Cuánto vendí este mes" es periodoDeVenta este_mes sobre toda la cuenta; "cuánto vendí de los eventos de este mes" es buscar esos eventos con periodo este_mes y después pedir sus ventas con periodoDeVenta todo.
- Decí siempre de qué período hablás, usando el texto de periodoAplicado.
- entradasPagas e invitaciones son cosas distintas. entradasTotales las suma. No digas "vendidas" por entradasTotales ni por invitaciones.
- recaudacionARS y precioPromedioARS son pesos argentinos, no cantidades de entradas.
- No hagas cuentas. Si te piden una comparación o cuánto creció algo, usá compararCon y leé los campos de variacion. Si porcentaje viene en null es porque el período anterior fue cero: decilo así, no inventes un porcentaje.
- No proyectes, no estimes y no extrapoles. Si el dato no está, decilo.
- Todavía no podés comparar eventos entre sí ni decir cuál vendió más: el backend no devuelve el desglose por evento. Explicalo y ofrecé el total de la cuenta o el detalle de un evento puntual.

Evolución diaria (evolucion_de_ventas):
- Usala para tendencia, mejor día o si las ventas se frenaron. Las fechas vienen en YYYY-MM-DD.
- total es el acumulado del período completo, no la suma de los días que ves: si truncated es true la serie está recortada a los últimos días y el total sigue siendo el del período entero.
- mejorDia ya viene elegido. No recorras la serie comparando cifras a ojo.
- Si diasIlegibles es mayor que cero, hay días que el backend mandó con una fecha que no se pudo interpretar: aclaralo.

Medios de pago (medios_de_pago):
- porcentajeDeRecaudacion ya viene calculado sobre el total del período. No lo recalcules. Si viene en null es porque la recaudación del período fue cero.
- Los medios vienen ordenados de mayor a menor recaudación: el primero es el principal.

Disponibilidad (disponibilidad):
- Es de UN evento por vez y necesita su ref. No existe una versión para toda la cuenta.
- vendidas no incluye invitaciones: son campos distintos, igual que en el resto de las herramientas.
- otrosEstados junta localidades en estados que no sabemos interpretar (reservas, emisiones en curso y similares). Si es mayor que cero mencionalo así, sin inventar qué son.
- ocupacionPorcentaje ya viene calculado. Si viene en null es porque el sector no tiene localidades cargadas.
- Esta herramienta no dice si el evento está activo, cancelado o pausado. Ese dato sigue sin estar disponible.

Límites generales:
- Podés responder sobre el catálogo de eventos, totales de venta, evolución diaria, medios de pago y disponibilidad por sector.
- No podés rankear eventos entre sí, ni dar disponibilidad de toda la cuenta de una vez.
- Si piden una capacidad no habilitada, explicalo brevemente y ofrecé lo que sí podés hacer.
- Nunca inventes eventos ni completes nombres, fechas o cifras ausentes.
- Si el resultado está truncado, decilo.
- Respondé en español rioplatense y de forma breve.
- Formato: podés usar **negrita** para resaltar cifras y viñetas con "- " para listas. No uses títulos, tablas, código ni links: la app sólo renderiza negrita y viñetas, y el resto se ve como texto con símbolos sueltos.
`;
};

export const tuentradaAgent = new Agent({
  name: "Analista de Tuentrada",
  model: process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra",
  instructions: buildInstructions,
  tools: [
    searchEventsTool,
    salesSummaryTool,
    salesHistoryTool,
    paymentMethodsTool,
    availabilityTool,
  ],
});

const sumUsage = (result) => {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  for (const response of result?.rawResponses ?? []) {
    inputTokens += response?.usage?.inputTokens ?? 0;
    outputTokens += response?.usage?.outputTokens ?? 0;
    totalTokens += response?.usage?.totalTokens ?? 0;
  }

  return { inputTokens, outputTokens, totalTokens };
};

const normalizeUsage = (usage) => ({
  inputTokens: Number(usage?.inputTokens) || 0,
  outputTokens: Number(usage?.outputTokens) || 0,
  totalTokens: Number(usage?.totalTokens) || 0,
});

const attachUsage = (error, usage) => {
  if (error && usage) error.usage = normalizeUsage(usage);
  return error;
};

export const answerWithAgent = async ({
  message,
  user,
  reports,
  signal,
  history = [],
  agent = tuentradaAgent,
  maxTurns = DEFAULT_MAX_TURNS,
  // Costura para poder testear el armado del input y el guard de finalOutput
  // sin llamar al modelo.
  runner = run,
}) => {
  const toolCalls = [];
  // Guardas que se activaron durante la consulta. Van al log en su propio
  // campo para poder contarlas sin depender de leer texto libre.
  const limites = [];

  // El historial previo va delante del mensaje nuevo. Con historial vacío esto
  // equivale a mandar sólo el turno actual.
  const input = [...history, { type: "message", role: "user", content: message }];

  let result;
  try {
    result = await runner(agent, input, {
      context: {
        user,
        reports,
        now: new Date(),
        audit: (toolName, parameters) => toolCalls.push({ toolName, parameters }),
        registrarLimite: (tipo, detalle) => limites.push({ tipo, ...detalle }),
      },
      maxTurns,
      signal,
      workflowName: "Tuentrada real-data catalog test",
    });
  } catch (error) {
    // Quedarse sin turnos no es un fallo genérico: es la señal de que maxTurns
    // quedó corto o de que el modelo se está enredando. Sale con su propio
    // status para poder contarlo en el log en vez de esconderse entre los 500.
    if (error instanceof MaxTurnsExceededError) {
      throw attachUsage(new AgentTurnLimitError(maxTurns), error.state?.usage);
    }
    throw attachUsage(error, error?.state?.usage);
  }

  const answer = result.finalOutput;
  // Un finalOutput ausente antes salía con 200 y una respuesta sin `answer`:
  // un fallo del servidor disfrazado de éxito, invisible en las métricas.
  if (typeof answer !== "string" || !answer.trim()) {
    throw attachUsage(
      new AgentOutputError("El run terminó sin finalOutput utilizable."),
      sumUsage(result),
    );
  }

  return {
    answer,
    toolCalls,
    limites,
    history: result.history,
    usage: sumUsage(result),
    // Cuántas veces habló el modelo. Es lo que hay que mirar para saber si
    // maxTurns quedó corto o sobra.
    turnos: result.rawResponses?.length ?? 0,
  };
};
