import { runLiveAgent } from "./liveAgent.mjs";
import { runMockAgent } from "./mockAgent.mjs";

const args = process.argv.slice(2);
const live = args.includes("--live");
const question = args.filter((arg) => arg !== "--live").join(" ").trim();
const ownerId = "demo-user";

const demoQuestions = [
  "¿Cuáles son mis eventos?",
  "Compará Festival Horizonte con Noche Neón esta semana",
  "¿Festival Horizonte creció respecto de la semana pasada?",
];

if (live && !process.env.OPENAI_API_KEY) {
  console.error(
    "Falta OPENAI_API_KEY. Configurala solamente en un entorno de servidor y volvé a ejecutar npm run agent:lab:live.",
  );
  process.exitCode = 1;
} else {
  const questions = question ? [question] : demoQuestions;

  console.log(live ? "Modo Agents SDK (API real)" : "Modo simulado (sin API ni costo)");
  console.log("Usuario autenticado de prueba: demo-user\n");

  for (const item of questions) {
    const calls = [];
    const audit = (toolName, parameters) => calls.push({ toolName, parameters });
    const answer = live
      ? await runLiveAgent(item, { ownerId, audit })
      : runMockAgent(item, { ownerId, audit });

    console.log(`Usuario: ${item}`);
    for (const call of calls) {
      console.log(`Herramienta: ${call.toolName} ${JSON.stringify(call.parameters)}`);
    }
    console.log(`Agente: ${answer}\n`);
  }
}
