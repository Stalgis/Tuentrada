const MAX_DIAS = 60;

const numero = (value) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * `day_date` llega en dos formatos según el endpoint: `YYYY-MM-DD` (a veces con
 * hora) o `DD-MM-YYYY` / `DD/MM/YYYY`. La app ya convive con los dos
 * (`parseDayDate` en SalesAnalyticsScreen).
 *
 * Al modelo tiene que llegar siempre YYYY-MM-DD: "05/03/2026" es 5 de marzo o
 * 3 de mayo según quién lo lea, y esa ambigüedad en una serie de ventas
 * termina en una respuesta con la fecha equivocada.
 */
export const normalizeDayDate = (value) => {
  const raw = String(value ?? "");

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const dia = dmy[1].padStart(2, "0");
    const mes = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mes}-${dia}`;
  }

  return "";
};

const toDia = (row) => ({
  fecha: normalizeDayDate(row?.day_date),
  entradasPagas: numero(row?.sold_tickets),
  invitaciones: numero(row?.sold_guest),
  entradasTotales: numero(row?.total_tickets),
  recaudacionARS: numero(row?.total_net),
});

/**
 * Separa la fila TOTAL, normaliza fechas y recorta la serie.
 *
 * La fila TOTAL viene mezclada dentro del array (`day_formatted === "TOTAL"`).
 * Si queda como un día más, el modelo la suma junto al resto y duplica todo.
 *
 * El recorte deja los últimos días, no los primeros: para "cómo vengo" importa
 * lo reciente. El total se calcula sobre la serie completa, así que truncar no
 * cambia la cifra global.
 */
export const toSalesHistory = (rows = [], maxDias = MAX_DIAS) => {
  const filas = Array.isArray(rows) ? rows : [];

  const totalRow = filas.find((row) => row?.day_formatted === "TOTAL") ?? null;
  const dias = filas
    .filter((row) => row?.day_formatted !== "TOTAL")
    .map(toDia)
    .filter((dia) => dia.fecha)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  // Filas cuyo day_date no se pudo interpretar: se cuentan en vez de
  // desaparecer, para que el modelo no afirme una serie incompleta.
  const diasIlegibles = filas.filter(
    (row) => row?.day_formatted !== "TOTAL" && !normalizeDayDate(row?.day_date),
  ).length;

  const total = totalRow
    ? toDia({ ...totalRow, day_date: "" })
    : dias.reduce(
        (acumulado, dia) => ({
          fecha: "",
          entradasPagas: acumulado.entradasPagas + dia.entradasPagas,
          invitaciones: acumulado.invitaciones + dia.invitaciones,
          entradasTotales: acumulado.entradasTotales + dia.entradasTotales,
          recaudacionARS: acumulado.recaudacionARS + dia.recaudacionARS,
        }),
        { fecha: "", entradasPagas: 0, invitaciones: 0, entradasTotales: 0, recaudacionARS: 0 },
      );

  const { fecha, ...totalSinFecha } = total;

  return {
    diasConVenta: dias.length,
    diasIlegibles,
    truncated: dias.length > maxDias,
    total: totalSinFecha,
    // Se calcula antes del recorte: el mejor día puede estar fuera de los 60
    // más recientes que se mandan al modelo.
    mejorDia: mejorDia(dias),
    dias: dias.slice(-maxDias),
  };
};

/** Día de mayor recaudación de la serie. Lo calcula el código, no el modelo. */
export const mejorDia = (dias) => {
  if (dias.length === 0) return null;
  return dias.reduce((mejor, dia) =>
    dia.recaudacionARS > mejor.recaudacionARS ? dia : mejor,
  );
};
