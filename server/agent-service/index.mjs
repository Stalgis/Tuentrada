import { answerWithAgent } from "./agent.mjs";
import { createUpstreamAuthenticator } from "./auth.mjs";
import { createAgentHttpServer } from "./httpServer.mjs";
import { ReportApiClient } from "./reportApiClient.mjs";

const required = (name, ...fallbackNames) => {
  const names = [name, ...fallbackNames];
  const value = names.map((key) => process.env[key]).find(Boolean);
  if (!value) {
    console.error(`Falta ${names.join(" o ")} en el entorno del servicio.`);
    process.exit(1);
  }
  return value;
};

required("OPENAI_API_KEY");
const reportBaseUrl = required("REPORT_API_BASE_URL", "EXPO_PUBLIC_BASE_URL");
const reportApiKey = required("REPORT_API_KEY", "EXPO_PUBLIC_API_KEY");

const host = process.env.AGENT_SERVICE_HOST || "127.0.0.1";
const port = Number(process.env.AGENT_SERVICE_PORT || 8787);
const allowedOrigin = process.env.AGENT_ALLOWED_ORIGIN || "*";

const authenticate = createUpstreamAuthenticator({
  createReports: (accessToken) =>
    new ReportApiClient({
      baseUrl: reportBaseUrl,
      apiKey: reportApiKey,
      accessToken,
    }),
});

const server = createAgentHttpServer({
  authenticate,
  answerQuestion: answerWithAgent,
  allowedOrigin,
});

server.listen(port, host, () => {
  console.log(`Agent service listening on http://${host}:${port}`);
  console.log("POST /api/agent/chat");
  console.log("Datos: catálogo real | Herramientas: sólo lectura");
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
