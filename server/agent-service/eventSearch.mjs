import { eventIsWithinRange } from "./eventDateRanges.mjs";

const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

/**
 * Busca sobre EVENTOS, no sobre funciones.
 *
 * Un evento entra en el rango si al menos una de sus funciones cae adentro:
 * preguntar "¿qué eventos tengo esta semana?" con un evento de 10 funciones
 * donde 2 son esta semana tiene que devolver ese evento, y decir cuántas
 * funciones son las que caen.
 */
export const searchEventCatalog = ({ eventos, consulta, range, limite }) => {
  const byName = consulta
    ? eventos.filter((evento) => normalize(evento.nombre).includes(normalize(consulta)))
    : eventos;

  const matches = [];
  for (const evento of byName) {
    const funcionesEnRango = evento.funciones.filter((funcion) =>
      eventIsWithinRange(funcion, range),
    );
    if (funcionesEnRango.length > 0) {
      matches.push({ evento, funcionesEnRango: funcionesEnRango.length });
    }
  }

  // Eventos que coinciden por nombre pero no tienen ninguna fecha usable: el
  // filtro temporal no los pudo evaluar. Sin este número el modelo afirma
  // "tenés 3 esta semana" sin saber que hay otros que nunca miró.
  const sinFecha = range
    ? byName.filter((evento) => evento.fechas.length === 0).length
    : 0;

  return {
    totalAccessible: eventos.length,
    totalMatches: matches.length,
    sinFecha,
    truncated: matches.length > limite,
    matches: matches.slice(0, limite),
  };
};
