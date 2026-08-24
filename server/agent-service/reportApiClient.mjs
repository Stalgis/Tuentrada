const REQUEST_TIMEOUT_MS = 20_000;

export class ReportAuthenticationError extends Error {
  constructor() {
    super("El backend rechazó la sesión.");
    this.name = "ReportAuthenticationError";
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

export class ReportTimeoutError extends Error {
  constructor() {
    super("El backend de reportes agotó el tiempo de espera.");
    this.name = "ReportTimeoutError";
  }
}

const normalizeEventList = (resources) => {
  const entries = Array.isArray(resources)
    ? resources.map((resource) => [String(resource.id), resource.label])
    : Object.entries(resources ?? {});

  return entries.map(([id, nameDate]) => {
    const label = String(nameDate);
    const dashIndex = label.lastIndexOf(" - ");
    const name = dashIndex >= 0 ? label.slice(0, dashIndex).trim() : label;
    const date = dashIndex >= 0 ? label.slice(dashIndex + 3).trim() : "";
    const dateISO = date ? `${date.replace(" ", "T")}-03:00` : "";
    const isPast = dateISO ? new Date(dateISO).getTime() < Date.now() : false;

    return {
      id,
      name,
      dateISO,
      status: isPast ? "finished" : "on_sale",
    };
  });
};

export class ReportApiClient {
  #accessToken;
  #apiKey;
  #baseUrl;
  #fetch;
  #eventListPromise = null;

  constructor({ baseUrl, apiKey, accessToken, fetchImpl = fetch }) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#apiKey = apiKey;
    this.#accessToken = accessToken;
    this.#fetch = fetchImpl;
  }

  async #request(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#accessToken}`,
          "x-api-key": this.#apiKey,
        },
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
      if (controller.signal.aborted) throw new ReportTimeoutError();
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listEvents() {
    if (!this.#eventListPromise) {
      this.#eventListPromise = this.#request("/api/v2/report/event-list")
        .then((data) => normalizeEventList(data?.resources))
        .catch((error) => {
          this.#eventListPromise = null;
          throw error;
        });
    }
    return this.#eventListPromise;
  }

  async validateAccess() {
    await this.listEvents();
  }
}
