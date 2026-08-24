import assert from "node:assert/strict";
import test from "node:test";
import {
  ReportApiClient,
  ReportAuthenticationError,
} from "../server/agent-service/reportApiClient.mjs";

test("carga y normaliza el catálogo real sin exponer el token", async () => {
  const requests = [];
  const client = new ReportApiClient({
    baseUrl: "https://reports.example.test/",
    apiKey: "public-client-key",
    accessToken: "private-user-token",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            resources: [
              { id: 42, label: "Festival Real - 2026-09-01 21:00:00" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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
      dateISO: "2026-09-01T21:00:00-03:00",
      status: "on_sale",
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
