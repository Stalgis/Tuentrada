import assert from "node:assert/strict";
import test from "node:test";
import {
  ReportApiClient,
  ReportApiError,
  ReportAuthenticationError,
  normalizeEventList,
} from "../server/agent-service/reportApiClient.mjs";
import { createCatalogCache } from "../server/agent-service/catalogCache.mjs";

const jsonResponse = (payload) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const VALID_STATS = {
  tickets: 4,
  invitations: 0,
  total_tickets: 4,
  total: 1_000,
  unique_buyers: 3,
};

test("carga y normaliza el catálogo real sin exponer el token", async () => {
  const requests = [];
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test/",
    apiKey: "public-client-key",
    accessToken: "private-user-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse({
        success: true,
        data: { resources: [{ id: 42, label: "Festival Real - 2026-09-01 21:00:00" }] },
      });
    },
  });

  await client.validateAccess();
  const events = await client.listEvents();

  assert.equal(requests.length, 1, "la validación reutiliza el catálogo cacheado");
  assert.equal(requests[0].url, "https://reports.example.test/api/v2/report/event-list");
  assert.equal(requests[0].init.headers.Authorization, "Bearer private-user-token");
  assert.equal(requests[0].init.headers["x-api-key"], "public-client-key");
  assert.deepEqual(events, [
    {
      id: "42",
      name: "Festival Real",
      fecha: "2026-09-01",
      dateISO: "2026-09-01T21:00:00-03:00",
      yaOcurrio: false,
    },
  ]);
});

test("clasifica 401 del backend como sesión inválida", async () => {
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "public-client-key",
    accessToken: "expired-token",
    fetchImpl: async () => new Response("{}", { status: 401 }),
  });

  await assert.rejects(() => client.validateAccess(), ReportAuthenticationError);
});

test("una etiqueta sin hora produce fecha usable, no un ISO roto", () => {
  // Antes esto armaba "2026-09-01-03:00", que es invalido: new Date() daba NaN
  // y el evento quedaba marcado como futuro para siempre.
  const [evento] = normalizeEventList(
    [{ id: 7, label: "Show sin hora - 2026-09-01" }],
    Date.parse("2026-08-01T00:00:00Z"),
  );

  assert.equal(evento.fecha, "2026-09-01");
  assert.equal(evento.dateISO, "2026-09-01T00:00:00-03:00");
  assert.equal(evento.yaOcurrio, false);
});

test("una etiqueta sin fecha deja yaOcurrio en null, no en false", () => {
  // false afirmaria que el evento no ocurrio, y eso no se sabe.
  const [sinSeparador] = normalizeEventList([{ id: 1, label: "Evento suelto" }]);
  assert.equal(sinSeparador.name, "Evento suelto");
  assert.equal(sinSeparador.fecha, "");
  assert.equal(sinSeparador.dateISO, "");
  assert.equal(sinSeparador.yaOcurrio, null);

  const [fechaBasura] = normalizeEventList([{ id: 2, label: "Evento - proximamente" }]);
  assert.equal(fechaBasura.fecha, "");
  assert.equal(fechaBasura.yaOcurrio, null);
});

test("el nombre puede contener guiones: se parte por el ultimo separador", () => {
  const [evento] = normalizeEventList([
    { id: 3, label: "Rock - Edición 2026 - 2026-03-05 20:00:00" },
  ]);
  assert.equal(evento.name, "Rock - Edición 2026");
  assert.equal(evento.fecha, "2026-03-05");
});

test("un evento pasado queda marcado como ya ocurrido", () => {
  const [evento] = normalizeEventList(
    [{ id: 4, label: "Ya fue - 2026-01-01 20:00:00" }],
    Date.parse("2026-08-01T00:00:00Z"),
  );
  assert.equal(evento.yaOcurrio, true);
});

test("la cache comparte el catalogo entre peticiones de la misma sesion", async () => {
  let calls = 0;
  const catalogCache = createCatalogCache({ ttlMs: 60_000 });
  const makeClient = (accessToken, cacheKey) =>
    new ReportApiClient({
      baseUrl: "https://reports.example.test",
      apiKey: "k",
      accessToken,
      catalogCache,
      cacheKey,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ success: true, data: { resources: [] } });
      },
    });

  // Dos peticiones distintas de la misma sesion: una sola carga.
  await makeClient("token-a", "fp-a").listEvents();
  await makeClient("token-a", "fp-a").listEvents();
  assert.equal(calls, 1);

  // Otra sesion no reutiliza nada: el aislamiento entre usuarios se mantiene.
  await makeClient("token-b", "fp-b").listEvents();
  assert.equal(calls, 2);
});

test("un fallo no se cachea: el siguiente intento vuelve a pedir", async () => {
  let calls = 0;
  const catalogCache = createCatalogCache({ ttlMs: 60_000 });
  const makeClient = () =>
    new ReportApiClient({
      baseUrl: "https://reports.example.test",
      apiKey: "k",
      accessToken: "t",
      catalogCache,
      cacheKey: "fp",
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response("{}", { status: 500 });
        return jsonResponse({ success: true, data: { resources: [] } });
      },
    });

  await assert.rejects(() => makeClient().listEvents());
  await makeClient().listEvents();
  assert.equal(calls, 2);
});

test("con ttl 0 la cache queda desactivada y siempre revalida", async () => {
  let calls = 0;
  const catalogCache = createCatalogCache({ ttlMs: 0 });
  const makeClient = () =>
    new ReportApiClient({
      baseUrl: "https://reports.example.test",
      apiKey: "k",
      accessToken: "t",
      catalogCache,
      cacheKey: "fp",
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ success: true, data: { resources: [] } });
      },
    });

  await makeClient().listEvents();
  await makeClient().listEvents();
  assert.equal(calls, 2);
});

test("fetchStats manda POST con los ids en el body y el período en la query", async () => {
  const requests = [];
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "public-client-key",
    accessToken: "private-user-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse({ success: true, data: { stats: VALID_STATS } });
    },
  });

  const stats = await client.fetchStats(["11", "12"], { date: "this_month" });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://reports.example.test/api/v2/report/stats?date=this_month");
  assert.equal(requests[0].init.method, "POST");
  // Los ids numéricos viajan como números, mismo criterio que el cliente de la app.
  assert.deepEqual(JSON.parse(requests[0].init.body), { ids: [11, 12] });
  assert.equal(requests[0].init.headers.Authorization, "Bearer private-user-token");
  assert.deepEqual(stats, VALID_STATS);
});

test("un id no numérico se conserva como string", async () => {
  const requests = [];
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async (url, init) => {
      requests.push(init);
      return jsonResponse({ success: true, data: { stats: VALID_STATS } });
    },
  });

  await client.fetchStats(["abc-123", "7"], { date: "all" });
  assert.deepEqual(JSON.parse(requests[0].body), { ids: ["abc-123", 7] });
});

test("dateFrom y dateTo sólo viajan con date=custom", async () => {
  const urls = [];
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse({ success: true, data: { stats: VALID_STATS } });
    },
  });

  await client.fetchStats(["1"], {
    date: "custom",
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
  });
  await client.fetchStats(["1"], {
    date: "this_week",
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
  });

  assert.match(urls[0], /\?date=custom&dateFrom=2026-01-01&dateTo=2026-01-31$/);
  assert.match(urls[1], /\?date=this_week$/, "mandar fechas con un preset confunde al backend");
});

test("fetchStats memoiza por peticion, sin importar el orden de los ids", async () => {
  let calls = 0;
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ success: true, data: { stats: { ...VALID_STATS, total: 1 } } });
    },
  });

  await client.fetchStats(["1", "2"], { date: "all" });
  await client.fetchStats(["2", "1"], { date: "all" });
  assert.equal(calls, 1, "si el modelo pide dos veces lo mismo en un run, se paga una");

  await client.fetchStats(["1", "2"], { date: "this_month" });
  assert.equal(calls, 2, "otro período es otra consulta");
});

test("un fallo de stats no queda memoizado", async () => {
  let calls = 0;
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response("{}", { status: 500 });
      return jsonResponse({ success: true, data: { stats: { ...VALID_STATS, total: 7 } } });
    },
  });

  await assert.rejects(() => client.fetchStats(["1"], { date: "all" }));
  assert.deepEqual(await client.fetchStats(["1"], { date: "all" }), {
    ...VALID_STATS,
    total: 7,
  });
  assert.equal(calls, 2);
});

test("un 401 en stats se clasifica como sesion invalida", async () => {
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "expired",
    fetchImpl: async () => new Response("{}", { status: 401 }),
  });

  await assert.rejects(
    () => client.fetchStats(["1"], { date: "all" }),
    ReportAuthenticationError,
  );
});

test("rechaza contratos financieros inválidos aunque el backend responda 200", async () => {
  const responses = [
    { success: true, data: { stats: { ...VALID_STATS, total: "no-numérico" } } },
    { success: true, data: { history: { rows: [] } } },
    { success: true, data: { payments: [{ payment_name: "Tarjeta", sold_tickets: 1 }] } },
    { success: true, data: { "online-sales": [{ price_type: "General", total: 10 }] } },
  ];
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async () => jsonResponse(responses.shift()),
  });

  await assert.rejects(() => client.fetchStats(["1"], { date: "all" }), ReportApiError);
  await assert.rejects(() => client.fetchHistory(["1"], { date: "all" }), ReportApiError);
  await assert.rejects(() => client.fetchPayments(["1"], { date: "all" }), ReportApiError);
  await assert.rejects(() => client.fetchOnlineSales("1"), ReportApiError);
});

test("una cancelación externa aborta la consulta activa y no se reporta como timeout", async () => {
  const controller = new AbortController();
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test",
    apiKey: "k",
    accessToken: "t",
    fetchImpl: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  client.setSignal(controller.signal);

  const pending = client.fetchStats(["1"], { date: "all" });
  controller.abort(new DOMException("client disconnected", "AbortError"));

  await assert.rejects(pending, (error) => {
    assert.equal(error.name, "AbortError");
    return true;
  });
});
