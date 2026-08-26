import { createHash } from "node:crypto";
import { ToolInputError } from "./toolErrors.mjs";

/**
 * Catálogo de dos niveles: evento y función.
 *
 * `event-list` devuelve una fila por función, no por evento. La app las agrupa
 * por nombre (`groupEventsByName` en src/lib/apiClient.ts) y el servicio del
 * agente no lo hacía: un usuario con 1 evento de 10 funciones preguntaba
 * "¿cuántos eventos tengo?" y escuchaba "tenés 10".
 *
 * Además de contar bien, agrupar es lo que hace posible pedir métricas: los
 * endpoints de ventas reciben ids de función, y el modelo sólo puede nombrar
 * eventos.
 */

const normalizeName = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Handle opaco que el modelo usa para referirse a un evento.
 *
 * Derivado del nombre normalizado, así que es estable entre peticiones sin
 * guardar estado. Lo que le da seguridad no es que sea difícil de adivinar,
 * sino que se valida contra el catálogo de esa sesión: un ref inventado falla
 * limpio en vez de devolver la recaudación de otro evento.
 */
export const eventRef = (name) =>
  `ev_${createHash("sha256").update(normalizeName(name)).digest("hex").slice(0, 8)}`;

/**
 * `yaOcurrio` a nivel evento, sin afirmar de más:
 * - false si alguna función todavía no ocurrió,
 * - true si todas ocurrieron,
 * - null si no alcanza la información (funciones sin fecha usable).
 */
const groupYaOcurrio = (funciones) => {
  if (funciones.some((funcion) => funcion.yaOcurrio === false)) return false;
  if (funciones.every((funcion) => funcion.yaOcurrio === true)) return true;
  return null;
};

export const buildEventCatalog = (funciones = []) => {
  const order = [];
  const groups = new Map();

  for (const funcion of funciones) {
    const key = normalizeName(funcion.name);
    if (!groups.has(key)) {
      order.push(key);
      groups.set(key, []);
    }
    groups.get(key).push(funcion);
  }

  const eventos = order.map((key) => {
    const group = groups.get(key);
    const conFecha = group
      .filter((funcion) => funcion.fecha)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

    return {
      ref: eventRef(group[0].name),
      nombre: group[0].name,
      funciones: group,
      fechas: conFecha.map((funcion) => funcion.fecha),
      primeraFecha: conFecha[0]?.fecha ?? "",
      ultimaFecha: conFecha[conFecha.length - 1]?.fecha ?? "",
      yaOcurrio: groupYaOcurrio(group),
    };
  });

  return { eventos, byRef: new Map(eventos.map((evento) => [evento.ref, evento])) };
};

/**
 * Traduce refs del modelo a ids de función para los endpoints de ventas.
 *
 * Un ref desconocido lanza ToolInputError: vuelve al modelo como texto para que
 * corrija, sin pegarle al backend. Es la garantía de que el agente nunca
 * responde con los números de un evento que no era.
 */
export const resolveEventRefs = (catalog, refs) => {
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new ToolInputError(
      "Indicá al menos un ref de evento, o usá alcance 'todos'. Los refs salen de buscar_eventos.",
    );
  }

  const desconocidos = refs.filter((ref) => !catalog.byRef.has(ref));
  if (desconocidos.length > 0) {
    throw new ToolInputError(
      `Estos refs no existen en el catálogo: ${desconocidos.join(", ")}. Llamá buscar_eventos y usá los refs que devuelve.`,
    );
  }

  const eventos = [];
  const vistos = new Set();
  const funcionIds = [];

  for (const ref of refs) {
    if (vistos.has(ref)) continue;
    vistos.add(ref);
    const evento = catalog.byRef.get(ref);
    eventos.push(evento);
    for (const funcion of evento.funciones) {
      if (funcion.id != null) funcionIds.push(String(funcion.id));
    }
  }

  return { eventos, funcionIds: [...new Set(funcionIds)] };
};

/** Ids de función de todo el catálogo, para alcance 'todos'. */
export const allFunctionIds = (catalog) => [
  ...new Set(
    catalog.eventos.flatMap((evento) =>
      evento.funciones.filter((funcion) => funcion.id != null).map((funcion) => String(funcion.id)),
    ),
  ),
];
