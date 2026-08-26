/**
 * Parser mínimo del formato que escribe el agente: negritas `**así**` y
 * viñetas `- así`.
 *
 * El modelo emite markdown porque resaltar las cifras ayuda a leer una
 * respuesta llena de números. Mostrarlo como texto plano dejaba los asteriscos
 * a la vista ("Tenés **86 eventos** cargados"), que es peor que no tener
 * negritas.
 *
 * Vive separado del componente para poder testearlo sin el runtime de React
 * Native. No es markdown completo a propósito: cubre exactamente lo que el
 * prompt le pide al modelo, sin sumar una dependencia. Cualquier otra sintaxis
 * cae como texto plano legible en vez de romperse.
 */

export type Span = { text: string; bold: boolean };

export type Block =
  | { tipo: "espacio" }
  | { tipo: "vineta"; spans: Span[] }
  | { tipo: "parrafo"; spans: Span[] };

const BOLD = /\*\*(.+?)\*\*/g;
const VINETA = /^\s*[-•*]\s+/;

const parseSpans = (linea: string): Span[] => {
  const spans: Span[] = [];
  let ultimo = 0;
  let match: RegExpExecArray | null;

  BOLD.lastIndex = 0;
  while ((match = BOLD.exec(linea)) !== null) {
    if (match.index > ultimo) {
      spans.push({ text: linea.slice(ultimo, match.index), bold: false });
    }
    spans.push({ text: match[1], bold: true });
    ultimo = match.index + match[0].length;
  }

  if (ultimo < linea.length) {
    spans.push({ text: linea.slice(ultimo), bold: false });
  }

  return spans.length > 0 ? spans : [{ text: linea, bold: false }];
};

export const parseAgentMarkdown = (texto: string): Block[] =>
  String(texto ?? "")
    .split("\n")
    .map((linea): Block => {
      // Una línea en blanco separa párrafos: se convierte en espacio real, no
      // en un renglón vacío que descuadra el interlineado.
      if (!linea.trim()) return { tipo: "espacio" };

      if (VINETA.test(linea)) {
        return { tipo: "vineta", spans: parseSpans(linea.replace(VINETA, "")) };
      }

      return { tipo: "parrafo", spans: parseSpans(linea) };
    });
