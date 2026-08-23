import { Agent, run } from "@openai/agents";

const agent = new Agent({
  name: "Tuentrada Agent",
  instructions:
    "Sos el agente de una aplicacion de portal de ventas de un proveedor de eventos. Tu tarea es con la informacion del backend responder a las preguntas del usuario sobre la informacion que el tiene.",
});

const result = await run(agent, "Cual es mi evento mas vendido?");
console.log(result.finalOutput);
