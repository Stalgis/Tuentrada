/**
 * Traducción de la respuesta cruda de /stats a lo que ve el modelo.
 *
 * Los nombres del backend mienten y hay que renombrarlos antes de que el modelo
 * los toque:
 *
 *   total         -> es PLATA, no una cantidad
 *   total_tickets -> es cantidad, e incluye invitaciones
 *   tickets       -> son las pagas, sin invitaciones
 *
 * Un modelo que recibe `total: 4200000` junto a `total_tickets: 850` puede
 * decir "vendiste 4.200.000 entradas" sin ninguna señal de que se equivocó.
 * Las magnitudes monetarias llevan la moneda en el nombre del campo.
 */

const numero = (value) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Los arrays chartTickets, chartInvitations, chartTotalTickets, chartTotal y
 * chartUniqueBuyers NO se incluyen a propósito: son ruido y tokens, y la serie
 * temporal con fechas la da /history.
 */
export const toSalesSummary = (stats) => {
  const recaudacionARS = numero(stats?.total);
  const entradasPagas = numero(stats?.tickets);

  return {
    entradasPagas,
    invitaciones: numero(stats?.invitations),
    entradasTotales: numero(stats?.total_tickets),
    recaudacionARS,
    // Se calcula acá, igual que `applyStatsToFlatEvents` en la app, en vez de
    // pasar el `ticket_medio` del backend: así el agente y el dashboard dicen
    // el mismo número, y la definición queda explícita (recaudación sobre
    // entradas pagas, sin contar invitaciones).
    precioPromedioARS: entradasPagas > 0 ? recaudacionARS / entradasPagas : 0,
    compradoresUnicos: numero(stats?.unique_buyers),
  };
};

const METRICAS_COMPARABLES = [
  "entradasPagas",
  "invitaciones",
  "entradasTotales",
  "recaudacionARS",
  "compradoresUnicos",
];

/**
 * Variación entre dos períodos, calculada en código.
 *
 * El modelo tiene prohibido hacer aritmética: un porcentaje mal calculado sobre
 * plata se lee tan convincente como uno bien calculado. `porcentaje` queda en
 * null cuando la base es cero, en vez de Infinity o de un 100% inventado.
 */
export const compararResumenes = (actual, previo) => {
  const variacion = {};

  for (const metrica of METRICAS_COMPARABLES) {
    const base = previo[metrica];
    const diferencia = actual[metrica] - base;
    variacion[metrica] = {
      diferencia,
      porcentaje: base === 0 ? null : Number(((diferencia / base) * 100).toFixed(2)),
    };
  }

  return variacion;
};
