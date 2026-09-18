// Datos ficticios: estas evaluaciones no acceden a cuentas ni al backend real.
export const cases = [
  ...["¿Cuántos eventos tengo?", "Listá mis eventos", "¿Tengo un recital?", "¿Cuándo es el recital?", "¿Qué eventos tengo este mes?", "¿Qué eventos tengo la semana que viene?"].map(message => ({ message, tool: "buscar_eventos" })),
  ...[
    ["¿Cuánto vendí hoy?", "hoy"], ["¿Cuánto vendí ayer?", "ayer"],
    ["¿Cuánto vendí esta semana?", "esta_semana"], ["¿Cuánto vendí la semana pasada?", "semana_pasada"],
    ["¿Cuánto vendí este mes?", "este_mes"], ["¿Cuánto vendí el mes pasado?", "mes_pasado"],
    ["¿Cuánto recaudé en total?", "todo"], ["¿Cuántas entradas pagas vendí este mes?", "este_mes"],
    ["¿Cuántas invitaciones emití este mes?", "este_mes"], ["¿Cuántos compradores únicos tuve este mes?", "este_mes"],
  ].map(([message, periodoDeVenta]) => ({ message, tool: "resumen_de_ventas", params: { periodoDeVenta } })),
  { message: "Compará lo vendido esta semana con la semana pasada", tool: "resumen_de_ventas", params: { periodoDeVenta: "esta_semana", compararCon: "semana_pasada" } },
  { message: "Compará ventas del 1 al 7 de junio de 2026 contra el 1 al 7 de mayo de 2026", tool: "resumen_de_ventas", params: { compararCon: "personalizado", compararDesde: "2026-05-01", compararHasta: "2026-05-07" } },
  ...["¿Cómo evolucionaron las ventas este mes?", "¿Cuál fue mi mejor día de ventas este mes?", "Mostrá ventas por día esta semana"].map(message => ({ message, tool: "evolucion_de_ventas" })),
  ...["¿Con qué medios me pagaron este mes?", "¿Qué medio de pago recaudó más?", "¿Qué porcentaje de la recaudación fue con tarjeta?"].map(message => ({ message, tool: "medios_de_pago" })),
  ...["¿Cuántas entradas quedan del Recital?", "¿Qué sectores tienen disponibilidad en Recital?"].map(message => ({ message, tool: "disponibilidad" })),
  ...[["¿Cómo activo notificaciones?", "notificaciones"], ["¿Cómo reinicio el chat?", "agente"], ["¿Cómo cambio mi contraseña?", "sesion"], ["¿Dónde veo los medios de pago?", "ventas"]].map(([message, tema]) => ({ message, tool: "ayuda_app", params: { tema } })),
  { message: "¿Cuál de mis eventos vendió más?", answerIncludes: "no", forbiddenTool: "resumen_de_ventas" },
  { message: "Cancelá el Recital", answerIncludes: "no" },
];
