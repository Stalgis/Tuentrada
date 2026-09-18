import { writeFile } from "node:fs/promises";
import { cases } from "./cases.mjs";

if (!process.argv.includes("--live")) {
  console.log(`${cases.length} casos sintéticos listos. Usá --live para ejecutar el modelo (consume API).`);
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
const { answerWithAgent } = await import("../agent.mjs");
const selected = process.argv.includes("--smoke") ? cases.filter(c => ["resumen_de_ventas", "disponibilidad", "ayuda_app"].includes(c.tool)).filter((c, i, all) => all.findIndex(other => other.tool === c.tool) === i) : cases;
const reports = {
  listEvents: async () => [{ id: "1", name: "Recital", fecha: "2026-12-10", dateISO: "2026-12-10T21:00:00-03:00", yaOcurrio: false }],
  fetchStats: async () => ({ tickets: 100, invitations: 10, total_tickets: 110, total: 100000, unique_buyers: 80 }),
  fetchHistory: async () => [{ day_date: "2026-09-01", day_formatted: "01/09", sold_tickets: 100, sold_guest: 10, total_tickets: 110, total_net: 100000 }],
  fetchPayments: async () => [{ payment_name: "Tarjeta", sold_tickets: 100, total_revenue: 100000 }],
  fetchOnlineSales: async () => [{ price_type: "General", total: 200, available: 90, purchase: 100, invitation: 10, kill: 0, promoter_blocked: 0 }],
};
const outcomes = [];
for (const item of selected) {
  const started = Date.now();
  try {
    const result = await answerWithAgent({ message: item.message, user: { id: "synthetic" }, reports, signal: AbortSignal.timeout(45000) });
    const called = result.toolCalls.find(c => c.toolName === item.tool && Object.entries(item.params ?? {}).every(([key, value]) => c.parameters[key] === value));
    const pass = (!item.tool || Boolean(called)) && (!item.forbiddenTool || !result.toolCalls.some(c => c.toolName === item.forbiddenTool)) && (!item.answerIncludes || result.answer.toLowerCase().includes(item.answerIncludes));
    outcomes.push({ ...item, pass, answer: result.answer, toolCalls: result.toolCalls, usage: result.usage, durationMs: Date.now() - started });
  } catch (error) { outcomes.push({ ...item, pass: false, error: error.name, durationMs: Date.now() - started }); }
  console.log(`${outcomes.at(-1).pass ? "PASS" : "FAIL"} ${item.message}`);
}
await writeFile(process.env.AGENT_EVAL_OUTPUT || "/tmp/tuentrada-agent-evals.json", JSON.stringify(outcomes, null, 2));
console.log(`${outcomes.filter(r => r.pass).length}/${outcomes.length} pasan. Revisar también exactitud de cifras y calidad de respuestas en el JSON.`);
process.exitCode = outcomes.some(r => !r.pass) ? 1 : 0;
