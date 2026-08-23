import { answerWithAgent } from "./agent.mjs";
import { DemoReportClient } from "./demoReportClient.mjs";
import { createAgentHttpServer } from "./httpServer.mjs";

if (!process.env.OPENAI_API_KEY) {
  console.error("Falta OPENAI_API_KEY en el entorno del servicio.");
  process.exit(1);
}

const host = process.env.AGENT_SERVICE_HOST || "127.0.0.1";
const port = Number(process.env.AGENT_SERVICE_PORT || 8787);
const expectedToken = process.env.AGENT_DEMO_TOKEN || "demo-token";

const server = createAgentHttpServer({
  expectedToken,
  reports: new DemoReportClient(),
  answerQuestion: answerWithAgent,
});

server.listen(port, host, () => {
  console.log(`Agent service listening on http://${host}:${port}`);
  console.log("POST /api/agent/chat");
  console.log("Datos: demostración | Autenticación: demostración");
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
