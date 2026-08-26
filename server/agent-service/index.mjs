import { answerWithAgent } from "./agent.mjs";
import { createUpstreamAuthenticator } from "./auth.mjs";
import { createCatalogCache } from "./catalogCache.mjs";
import { createConversationStore } from "./conversationStore.mjs";
import { createGuards } from "./guards.mjs";
import { createAgentHttpServer } from "./httpServer.mjs";
import { ReportApiClient } from "./reportApiClient.mjs";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Una variable definida pero vacía cuenta como ausente. Antes `.find(Boolean)`
 * la salteaba en silencio y caía al fallback: un `REPORT_API_KEY=` vacío
 * terminaba usando la clave pública de Expo sin que nadie se enterara.
 */
const readEnv = (name) => {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const required = (name, ...fallbackNames) => {
  const names = [name, ...fallbackNames];
  for (const key of names) {
    const value = readEnv(key);
    if (value) {
      if (key !== name) {
        console.warn(`${name} no está definida; usando ${key} como fallback.`);
      }
      return value;
    }
  }
  console.error(`Falta ${names.join(" o ")} en el entorno del servicio.`);
  process.exit(1);
};

const readNumber = (name, fallback) => {
  const raw = readEnv(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`${name} debe ser un número >= 0. Recibido: ${raw}`);
    process.exit(1);
  }
  return value;
};

const openaiApiKey = required("OPENAI_API_KEY");
const reportBaseUrl = required("REPORT_API_BASE_URL", "EXPO_PUBLIC_BASE_URL");
const reportApiKey = required("REPORT_API_KEY", "EXPO_PUBLIC_API_KEY");

const host = readEnv("AGENT_SERVICE_HOST") || "127.0.0.1";
const port = readNumber("AGENT_SERVICE_PORT", 8787);
const allowedOrigin = readEnv("AGENT_ALLOWED_ORIGIN") || "*";
const model = readEnv("OPENAI_AGENT_MODEL") || "gpt-5.6-terra";

// Un default inseguro que sólo está documentado sigue siendo un default
// inseguro. En producción hay que declarar el origen a mano.
if (isProduction && allowedOrigin === "*") {
  console.error(
    "AGENT_ALLOWED_ORIGIN no puede quedar en '*' con NODE_ENV=production. Declará el origen permitido.",
  );
  process.exit(1);
}

const exposeToolCalls = readEnv("AGENT_EXPOSE_TOOL_CALLS") === "true";
if (exposeToolCalls && isProduction) {
  console.error("AGENT_EXPOSE_TOOL_CALLS no puede estar activo en producción.");
  process.exit(1);
}

const requestTimeoutMs = readNumber("AGENT_REQUEST_TIMEOUT_MS", 35_000);
const reportTimeoutMs = readNumber("REPORT_API_TIMEOUT_MS", 20_000);
if (reportTimeoutMs >= requestTimeoutMs) {
  console.error(
    "REPORT_API_TIMEOUT_MS debe ser menor que AGENT_REQUEST_TIMEOUT_MS: si no, autenticar puede consumir el presupuesto entero.",
  );
  process.exit(1);
}

const maxUpstreamCalls = readNumber("AGENT_MAX_UPSTREAM_CALLS", 25);

const catalogCache = createCatalogCache({
  ttlMs: readNumber("AGENT_CATALOG_CACHE_TTL_MS", 60_000),
});

const conversations = createConversationStore({
  ttlMs: readNumber("AGENT_CONVERSATION_TTL_MS", 30 * 60_000),
  maxItems: readNumber("AGENT_CONVERSATION_MAX_ITEMS", 40),
});

const guards = createGuards({
  maxPerWindow: readNumber("AGENT_RATE_LIMIT_MAX", 30),
  maxGlobalPerWindow: readNumber("AGENT_GLOBAL_RATE_LIMIT_MAX", 1_000),
  windowMs: readNumber("AGENT_RATE_LIMIT_WINDOW_MS", 3_600_000),
  maxConcurrent: readNumber("AGENT_MAX_CONCURRENT", 4),
  dailyTokenBudget: readNumber("AGENT_DAILY_TOKEN_BUDGET", 1_000_000),
});

const authenticate = createUpstreamAuthenticator({
  createReports: (accessToken, fingerprint) =>
    new ReportApiClient({
      baseUrl: reportBaseUrl,
      apiKey: reportApiKey,
      accessToken,
      catalogCache,
      cacheKey: fingerprint,
      timeoutMs: reportTimeoutMs,
      maxUpstreamCalls,
    }),
});

/**
 * Un id de modelo inexistente o dado de baja convierte todas las peticiones en
 * un 500 genérico sin pista. Mejor enterarse al arrancar.
 * Un fallo de red no bloquea el arranque: sólo avisa.
 */
const verifyModel = async () => {
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${model}`, {
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) {
      console.error(`El modelo "${model}" no existe o la cuenta no tiene acceso.`);
      process.exit(1);
    }
    if (response.status === 401 || response.status === 403) {
      console.error("OPENAI_API_KEY rechazada por OpenAI.");
      process.exit(1);
    }
    if (!response.ok) {
      console.warn(`No se pudo verificar el modelo (HTTP ${response.status}). Sigo igual.`);
      return;
    }
    console.log(`Modelo verificado: ${model}`);
  } catch (error) {
    console.warn(`No se pudo verificar el modelo (${error?.message}). Sigo igual.`);
  }
};

const server = createAgentHttpServer({
  authenticate,
  answerQuestion: answerWithAgent,
  allowedOrigin,
  requestTimeoutMs,
  guards,
  conversations,
  exposeToolCalls,
});

await verifyModel();

server.listen(port, host, () => {
  console.log(`Agent service listening on http://${host}:${port}`);
  console.log("POST /api/agent/chat");
  console.log("Datos: catálogo real | Herramientas: sólo lectura");
  console.log(
    `Topes: ${guards.stats().dailyTokenBudget || "sin"} tokens/día | ${maxUpstreamCalls} consultas backend/petición | ${process.env.AGENT_MAX_TURNS || 6} turnos | timeout ${requestTimeoutMs}ms | toolCalls al cliente: ${exposeToolCalls}`,
  );
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
