import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentMarkdown } from "../src/lib/agentMarkdown.ts";

const plano = (blocks) =>
  blocks.map((b) => (b.tipo === "espacio" ? "" : b.spans.map((s) => s.text).join("")));

const negritas = (blocks) =>
  blocks.flatMap((b) => (b.tipo === "espacio" ? [] : b.spans.filter((s) => s.bold).map((s) => s.text)));

test("los asteriscos no llegan a la pantalla", () => {
  // Era el defecto mas visible: "Tenes **86 eventos** cargados" se leia con los
  // asteriscos crudos en cada respuesta.
  const blocks = parseAgentMarkdown("Tenés **86 eventos** cargados.");

  assert.deepEqual(plano(blocks), ["Tenés 86 eventos cargados."]);
  assert.deepEqual(negritas(blocks), ["86 eventos"]);
});

test("varias negritas en una linea", () => {
  const blocks = parseAgentMarkdown(
    "Este mes vendiste **37.720 entradas pagas** y emitiste **4.026 invitaciones**.",
  );

  assert.deepEqual(negritas(blocks), ["37.720 entradas pagas", "4.026 invitaciones"]);
  assert.equal(plano(blocks)[0].includes("*"), false);
});

test("las vinetas salen como lista, sin el guion literal", () => {
  const blocks = parseAgentMarkdown(
    "Este mes (agosto) tenés **13 eventos**:\n\n- Charlie Y La Fábrica De Chocolate — 98 funciones en total; 5 en agosto.\n- Paren La Mano Circus — 1 función.",
  );

  assert.equal(blocks[0].tipo, "parrafo");
  assert.equal(blocks[1].tipo, "espacio");
  assert.equal(blocks[2].tipo, "vineta");
  assert.equal(blocks[3].tipo, "vineta");
  assert.equal(
    plano(blocks)[2],
    "Charlie Y La Fábrica De Chocolate — 98 funciones en total; 5 en agosto.",
  );
});

test("una vineta puede tener negritas adentro", () => {
  const blocks = parseAgentMarkdown("- **Entradas pagas:** 37.720, una baja de **56,59%**.");

  assert.equal(blocks[0].tipo, "vineta");
  assert.deepEqual(negritas(blocks), ["Entradas pagas:", "56,59%"]);
});

test("acepta los tres marcadores de vineta", () => {
  for (const marca of ["-", "•", "*"]) {
    const [block] = parseAgentMarkdown(`${marca} Un ítem`);
    assert.equal(block.tipo, "vineta", `no reconocio "${marca}"`);
    assert.equal(block.spans[0].text, "Un ítem");
  }
});

test("un asterisco suelto no rompe ni desaparece", () => {
  const blocks = parseAgentMarkdown("El 3 * 4 es 12 y esto ** queda solo");
  assert.equal(plano(blocks)[0], "El 3 * 4 es 12 y esto ** queda solo");
  assert.deepEqual(negritas(blocks), []);
});

test("las lineas en blanco se vuelven espacio, no renglones vacios", () => {
  const blocks = parseAgentMarkdown("Primero\n\nSegundo");
  assert.deepEqual(
    blocks.map((b) => b.tipo),
    ["parrafo", "espacio", "parrafo"],
  );
});

test("texto vacio o nulo no rompe", () => {
  assert.deepEqual(parseAgentMarkdown(""), [{ tipo: "espacio" }]);
  assert.deepEqual(parseAgentMarkdown(null), [{ tipo: "espacio" }]);
  assert.deepEqual(parseAgentMarkdown(undefined), [{ tipo: "espacio" }]);
});

test("una respuesta larga real se parsea entera", () => {
  const real = [
    "Este mes, comparado con el mes pasado:",
    "",
    "- **Entradas pagas:** 37.720, una baja de **56,59%**.",
    "- **Recaudación:** $3.073.410.350 ARS, una baja de **51,77%**.",
    "- **Compradores únicos:** 16.842, una baja de **39,84%**.",
    "- **Invitaciones:** 4.026, un alza de **14,08%**.",
  ].join("\n");

  const blocks = parseAgentMarkdown(real);

  assert.equal(blocks.filter((b) => b.tipo === "vineta").length, 4);
  assert.equal(negritas(blocks).length, 8);
  // Ni un asterisco sobrevive al parseo.
  assert.equal(plano(blocks).join("").includes("*"), false);
});
