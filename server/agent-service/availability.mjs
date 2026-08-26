const numero = (value) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

const SECTOR_VACIO = () => ({
  localidades: 0,
  disponibles: 0,
  vendidas: 0,
  invitaciones: 0,
  bloqueadas: 0,
});

/**
 * Traducción de un sector, con la misma interpretación que usa la app
 * (SectorScreen): disponibles = available, vendidas = purchase,
 * invitaciones = invitation, bloqueadas = kill + promoter_blocked.
 *
 * `vendidas` NO incluye invitaciones. Es la misma regla que en el resto del
 * agente: una invitación no es una venta.
 */
const acumular = (destino, sector) => {
  destino.localidades += numero(sector.total);
  destino.disponibles += numero(sector.available);
  destino.vendidas += numero(sector.purchase);
  destino.invitaciones += numero(sector.invitation);
  destino.bloqueadas += numero(sector.kill) + numero(sector.promoter_blocked);
  return destino;
};

/**
 * `otrosEstados` cierra la cuenta.
 *
 * El backend manda además booking, issue, in_progress y session_pack, que la
 * app tampoco interpreta. Sin este campo las partes no suman el total y el
 * modelo se inventa una explicación para la diferencia; con él ve un balde
 * etiquetado y puede decir que no sabe qué son.
 */
const cerrar = (sector) => ({
  ...sector,
  otrosEstados: Math.max(
    0,
    sector.localidades -
      sector.disponibles -
      sector.vendidas -
      sector.invitaciones -
      sector.bloqueadas,
  ),
  ocupacionPorcentaje:
    sector.localidades === 0
      ? null
      : Number((((sector.localidades - sector.disponibles) / sector.localidades) * 100).toFixed(2)),
});

/**
 * Suma los sectores de todas las funciones de un evento.
 *
 * Las filas con `is_total_general` son el total que arma el backend por
 * función: se descartan y el total se recalcula sobre los sectores, porque
 * sumar totales por función junto a sus propias filas contaría todo dos veces.
 */
export const aggregateAvailability = (respuestasPorFuncion = []) => {
  const porSector = new Map();

  for (const sectores of respuestasPorFuncion) {
    for (const sector of Array.isArray(sectores) ? sectores : []) {
      if (sector?.is_total_general) continue;
      const nombre = String(sector?.price_type ?? "").trim() || "Sin nombre";
      if (!porSector.has(nombre)) porSector.set(nombre, SECTOR_VACIO());
      acumular(porSector.get(nombre), sector);
    }
  }

  const sectores = [...porSector.entries()]
    .map(([sector, valores]) => ({ sector, ...cerrar(valores) }))
    .sort((a, b) => b.localidades - a.localidades);

  const total = sectores.reduce(
    (acumulado, sector) =>
      acumular(acumulado, {
        total: sector.localidades,
        available: sector.disponibles,
        purchase: sector.vendidas,
        invitation: sector.invitaciones,
        kill: sector.bloqueadas,
        promoter_blocked: 0,
      }),
    SECTOR_VACIO(),
  );

  return { total: cerrar(total), sectores };
};
