const numero = (value) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Desglose por medio de pago.
 *
 * `total_revenue` a veces llega como string, igual que en el cliente de la app
 * (`fetchPayments` en src/lib/reportApi.ts).
 *
 * El campo se llama `entradas` y no `entradasPagas` a propósito: si el backend
 * llegara a emitir una fila "Invitación", llamarlas pagas sería falso. Acá el
 * nombre no afirma nada que no se sepa.
 */
export const toPaymentMethods = (rows = []) => {
  const filas = (Array.isArray(rows) ? rows : []).map((row) => ({
    medio: String(row?.payment_name ?? "").trim() || "Sin identificar",
    entradas: numero(row?.sold_tickets),
    recaudacionARS: numero(row?.total_revenue),
  }));

  const recaudacionTotalARS = filas.reduce((total, fila) => total + fila.recaudacionARS, 0);
  const entradasTotales = filas.reduce((total, fila) => total + fila.entradas, 0);

  // El porcentaje lo calcula el código: "¿qué parte se paga con tarjeta?" es la
  // pregunta obvia y el modelo tiene prohibido hacer cuentas sobre plata.
  const medios = filas
    .map((fila) => ({
      ...fila,
      porcentajeDeRecaudacion:
        recaudacionTotalARS === 0
          ? null
          : Number(((fila.recaudacionARS / recaudacionTotalARS) * 100).toFixed(2)),
    }))
    // De mayor a menor: el medio principal queda primero y el modelo no tiene
    // que ordenar nada para responder "cuál se usa más".
    .sort((a, b) => b.recaudacionARS - a.recaudacionARS);

  return { medios, recaudacionTotalARS, entradasTotales };
};
