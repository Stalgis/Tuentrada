// Igualado al timeout del cliente de la app (src/lib/reportApi.ts): con 12s el
// agente fallaba en /history sobre cuentas grandes justo donde la app aguanta.
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_UPSTREAM_CALLS = 25;

/**
 * Todo error que pueda escapar de una tool lleva su propio `httpStatus`.
 *
 * Sin eso cae al catch-all del httpServer y sale como 500 "No se pudo procesar
 * la consulta": el usuario no sabe qué pasó, y en el caso de la sesión vencida
 * la app ni siquiera lo saca a login, porque el cliente reacciona al 401 y
 * nunca lo ve.
 */
export class ReportAuthenticationError extends Error {
  constructor() {
    super("El backend rechazó la sesión.");
    this.name = "ReportAuthenticationError";
    this.httpStatus = 401;
    this.publicMessage = "La sesión venció o no es válida.";
  }
}

export class ReportApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ReportApiError";
    this.status = status;
    this.httpStatus = 502;
    this.publicMessage = "El backend de reportes no pudo responder.";
  }
}

/**
 * Tope de consultas al backend por petición del chat.
 *
 * Cada tool tiene su propio límite, pero eso es por llamada: nada impedía que
 * un run de varios turnos encadenara doce consultas de disponibilidad seis
 * veces. Este contador es por instancia del cliente, o sea por petición, y es
 * el techo real del costo de una pregunta.
 */
export class UpstreamBudgetError extends Error {
  constructor(max) {
    super(`La consulta superó el tope de ${max} llamadas al backend.`);
    this.name = "UpstreamBudgetError";
    this.httpStatus = 503;
    this.publicMessage = "La consulta requirió demasiadas búsquedas. Probá con una pregunta más acotada.";
  }
}

export class ReportTimeoutError extends Error {
  constructor() {
    super("El backend de reportes agotó el tiempo de espera.");
    this.name = "ReportTimeoutError";
    this.httpStatus = 504;
    this.publicMessage =
      "El backend tardó demasiado en responder. Probá acotando la consulta a un evento puntual o a un período más corto.";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNumeric = (value) =>
  (typeof value === "number" && Number.isFinite(value)) ||
  (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));

const invalidContract = (resource) =>
  new ReportApiError(502, `Contrato inválido en ${resource}.`);

const requireNumericFields = (value, fields, resource) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidContract(resource);
  }
  if (fields.some((field) => !isNumeric(value[field]))) {
    throw invalidContract(resource);
  }
  return value;
};

const validateStats = (data) =>
  requireNumericFields(
    data?.stats,
    ["tickets", "invitations", "total_tickets", "total", "unique_buyers"],
    "stats",
  );

const validateRows = (rows, fields, resource) => {
  if (!Array.isArray(rows)) throw invalidContract(resource);
  for (const row of rows) requireNumericFields(row, fields, resource);
  return rows;
};

const validateHistory = (data) => {
  const rows = validateRows(
    data?.history,
    ["sold_tickets", "sold_guest", "total_tickets", "total_net"],
    "history",
  );
  if (
    rows.some(
      (row) =>
        typeof row.day_formatted !== "string" ||
        (row.day_formatted !== "TOTAL" && typeof row.day_date !== "string"),
    )
  ) {
    throw invalidContract("history");
  }
  return rows;
};

const validatePayments = (data) => {
  const rows = validateRows(
    data?.payments,
    ["sold_tickets", "total_revenue"],
    "payments",
  );
  if (rows.some((row) => typeof row.payment_name !== "string")) {
    throw invalidContract("payments");
  }
  return rows;
};

const validateOnlineSales = (data) => {
  const rows = validateRows(
    data?.["online-sales"],
    ["total", "available", "purchase", "invitation", "kill", "promoter_blocked"],
    "online-sales",
  );
  if (rows.some((row) => typeof row.price_type !== "string")) {
    throw invalidContract("online-sales");
  }
  return rows;
};

/**
 * `dateFrom`/`dateTo` sólo viajan con `date=custom`, igual que hace el cliente
 * de la app. Mandarlos con un preset confunde al backend.
 */
const buildQuery = ({ id, date, dateFrom, dateTo }) => {
  const params = new URLSearchParams();
  if (id != null && id !== "") params.set("id", String(id));
  if (date) params.set("date", date);
  if (date === "custom" && dateFrom) params.set("dateFrom", dateFrom);
  if (date === "custom" && dateTo) params.set("dateTo", dateTo);
  const out = params.toString();
  return out ? `?${out}` : "";
};

/**
 * El backend espera ids numéricos cuando lo son. Mismo criterio que
 * `normalizeIds` en src/lib/reportApi.ts.
 */
const normalizeIds = (ids) =>
  [...new Set(ids)].map((id) => {
    const numeric = Number(id);
    return Number.isSafeInteger(numeric) ? numeric : id;
  });

/** Clave de memo por (recurso, ids, período). El orden de los ids no importa. */
const reportKey = (recurso, ids, { date, dateFrom, dateTo } = {}) =>
  `${recurso}|${[...ids].sort().join(",")}|${date ?? ""}|${dateFrom ?? ""}|${dateTo ?? ""}`;

/**
 * El backend manda `"Nombre del evento - 2026-09-01 21:00:00"`. Se parte por el
 * último " - " porque el nombre puede contener guiones.
 *
 * Devuelve tres campos distintos a propósito:
 * - `fecha`: YYYY-MM-DD, o "" si el backend no mandó una fecha usable. Es lo
 *   único que usa el filtro temporal.
 * - `dateISO`: timestamp completo, o "" si no se pudo construir uno válido.
 * - `yaOcurrio`: true/false, o `null` cuando no hay fecha. Antes esto se
 *   llamaba `status: on_sale | finished`, que prometía un estado comercial que
 *   el backend nunca mandó: un evento cancelado o agotado salía "on_sale".
 *   El nombre ahora dice exactamente lo que el dato es.
 */
const normalizeEventList = (resources, nowMs = Date.now()) => {
  const entries = Array.isArray(resources)
    ? resources.map((resource) => [String(resource.id), resource.label])
    : Object.entries(resources ?? {});

  return entries.map(([id, nameDate]) => {
    const label = String(nameDate);
    const dashIndex = label.lastIndexOf(" - ");
    const name = dashIndex >= 0 ? label.slice(0, dashIndex).trim() : label;
    const rawDate = dashIndex >= 0 ? label.slice(dashIndex + 3).trim() : "";

    const [datePart, timePart] = rawDate.split(" ");
    const fecha = ISO_DATE.test(datePart ?? "") ? datePart : "";

    // Argentina no tiene horario de verano: el offset es -03:00 todo el año.
    const candidate = fecha ? `${fecha}T${timePart || "00:00:00"}-03:00` : "";
    const parsed = candidate ? new Date(candidate).getTime() : Number.NaN;
    const dateISO = Number.isNaN(parsed) ? "" : candidate;

    return {
      id,
      name,
      fecha,
      dateISO,
      yaOcurrio: Number.isNaN(parsed) ? null : parsed < nowMs,
    };
  });
};

export class ReportApiClient {
  #accessToken;
  #apiKey;
  #baseUrl;
  #cacheKey;
  #catalogCache;
  #fetch;
  #eventListPromise = null;
  #reportPromises = new Map();
  #timeoutMs;
  #maxUpstreamCalls;
  #upstreamCalls = 0;
  #signal = null;

  constructor({
    baseUrl,
    apiKey,
    accessToken,
    fetchImpl = fetch,
    catalogCache = null,
    cacheKey = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxUpstreamCalls = DEFAULT_MAX_UPSTREAM_CALLS,
  }) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#apiKey = apiKey;
    this.#accessToken = accessToken;
    this.#fetch = fetchImpl;
    this.#catalogCache = catalogCache;
    this.#cacheKey = cacheKey;
    this.#timeoutMs = timeoutMs;
    this.#maxUpstreamCalls = maxUpstreamCalls;
  }

  /** Consultas efectivas al backend en esta petición. Va a la línea de log. */
  get upstreamCalls() {
    return this.#upstreamCalls;
  }

  /** Se configura después de autenticar para no cancelar una carga de catálogo compartida. */
  setSignal(signal) {
    this.#signal = signal ?? null;
  }

  async #request(path, { method = "GET", body, query } = {}) {
    // Se verifica antes de contar, así el contador refleja consultas que de
    // verdad salieron. Si contara los intentos bloqueados, la línea de log
    // diría 31 cuando al backend llegaron 25, y cualquier análisis de costo
    // partiría de un número inflado.
    if (this.#upstreamCalls >= this.#maxUpstreamCalls) {
      throw new UpstreamBudgetError(this.#maxUpstreamCalls);
    }
    this.#upstreamCalls += 1;

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const parentSignal = this.#signal;
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    const search = query ? buildQuery(query) : "";

    try {
      const response = await this.#fetch(`${this.#baseUrl}${path}${search}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.#accessToken}`,
          "x-api-key": this.#apiKey,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new ReportAuthenticationError();
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new ReportApiError(response.status, "Respuesta no JSON del backend.");
      }

      if (!response.ok || payload?.success === false) {
        throw new ReportApiError(
          response.status,
          typeof payload?.message === "string"
            ? payload.message
            : "Error del backend de reportes.",
        );
      }

      return payload.data;
    } catch (error) {
      if (timedOut) throw new ReportTimeoutError();
      if (parentSignal?.aborted) {
        throw parentSignal.reason instanceof Error
          ? parentSignal.reason
          : new DOMException("La petición fue cancelada.", "AbortError");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }

  #loadEvents() {
    return this.#request("/api/v2/report/event-list").then((data) =>
      normalizeEventList(data?.resources),
    );
  }

  async listEvents() {
    // Caché compartida entre peticiones de la misma sesión cuando está
    // configurada; si no, memo por instancia (una sola carga por petición).
    if (this.#catalogCache && this.#cacheKey) {
      return this.#catalogCache.resolve(this.#cacheKey, () => this.#loadEvents());
    }

    if (!this.#eventListPromise) {
      this.#eventListPromise = this.#loadEvents().catch((error) => {
        this.#eventListPromise = null;
        throw error;
      });
    }
    return this.#eventListPromise;
  }

  /**
   * Memo por instancia, o sea por petición: si el modelo pide dos veces lo
   * mismo en el mismo run, se paga una. No se comparte entre peticiones porque
   * los datos de venta cambian y no queremos servir cifras viejas.
   */
  #memo(key, loader) {
    if (!this.#reportPromises.has(key)) {
      const promise = loader().catch((error) => {
        this.#reportPromises.delete(key);
        throw error;
      });
      this.#reportPromises.set(key, promise);
    }
    return this.#reportPromises.get(key);
  }

  #postReport(path, recurso, functionIds, period, extract) {
    const ids = normalizeIds(functionIds);
    return this.#memo(reportKey(recurso, ids, period), () =>
      this.#request(path, { method: "POST", body: { ids }, query: period }).then(extract),
    );
  }

  /**
   * Agregado de ventas para un conjunto de funciones. Una sola llamada, sin
   * importar cuántos ids: el backend no devuelve desglose por id (por eso el
   * ranking entre eventos queda fuera de la fase 1).
   */
  async fetchStats(functionIds, period) {
    return this.#postReport(
      "/api/v2/report/stats",
      "stats",
      functionIds,
      period,
      validateStats,
    );
  }

  /** Serie diaria de ventas. Incluye una fila TOTAL mezclada en el array. */
  async fetchHistory(functionIds, period) {
    return this.#postReport(
      "/api/v2/report/history",
      "history",
      functionIds,
      period,
      validateHistory,
    );
  }

  /** Desglose por medio de pago. */
  async fetchPayments(functionIds, period) {
    return this.#postReport(
      "/api/v2/report/payments",
      "payments",
      functionIds,
      period,
      validatePayments,
    );
  }

  /**
   * Sectores de UNA función. Es el único endpoint sin forma de lote: por eso la
   * tool de disponibilidad exige un solo evento y tiene tope de funciones.
   */
  async fetchOnlineSales(functionId) {
    return this.#memo(reportKey("online-sales", [functionId]), () =>
      this.#request("/api/v2/report/online-sales", {
        query: { id: functionId },
      }).then(validateOnlineSales),
    );
  }

  async validateAccess() {
    await this.listEvents();
  }
}

export { normalizeEventList };
