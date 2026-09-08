import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORTED_PAYLOAD_VERSION,
  parseNotificationDestination,
  reportTitle,
} from "../src/lib/pushPayload.ts";

test("lee el payload de una función cerrada", () => {
  const destination = parseNotificationDestination({
    type: "function_report",
    reportId: "rep_1",
    functionId: "fn_1042",
    v: 1,
  });

  // Los campos ausentes no viajan en el destino: la ruta recibe sólo lo que
  // el backend mandó.
  assert.deepEqual(destination, {
    type: "function_report",
    reportId: "rep_1",
    functionId: "fn_1042",
  });
});

test("acepta los campos como strings, que es como llegan en Android", () => {
  const destination = parseNotificationDestination({
    type: "weekly_report",
    reportId: "rep_2",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-07",
    v: "1",
  });

  assert.equal(destination?.periodStart, "2026-09-01");
  assert.equal(destination?.periodEnd, "2026-09-07");
});

test("los campos vacíos no invalidan el payload", () => {
  const destination = parseNotificationDestination({
    type: "weekly_report",
    reportId: "rep_3",
    functionId: "",
    eventId: "   ",
  });

  assert.equal(destination?.reportId, "rep_3");
  assert.equal(destination?.functionId, undefined);
  assert.equal(destination?.eventId, undefined);
});

test("sin versión se asume la primera", () => {
  const destination = parseNotificationDestination({
    type: "event_report",
    reportId: "rep_4",
    eventId: "ev_9",
  });

  assert.equal(destination?.type, "event_report");
  assert.equal(SUPPORTED_PAYLOAD_VERSION, 1);
});

test("ignora lo que esta build no sabe abrir", () => {
  // tipo que todavía no existe en esta versión de la app
  assert.equal(
    parseNotificationDestination({ type: "sales_alert", reportId: "rep_5" }),
    null,
  );
  // formato más nuevo que el soportado
  assert.equal(
    parseNotificationDestination({ type: "weekly_report", reportId: "rep_6", v: 2 }),
    null,
  );
  // sin identificador no hay adónde navegar
  assert.equal(parseNotificationDestination({ type: "weekly_report" }), null);
  assert.equal(
    parseNotificationDestination({ type: "weekly_report", reportId: "   " }),
    null,
  );
  assert.equal(parseNotificationDestination(undefined), null);
  assert.equal(parseNotificationDestination("no soy un objeto"), null);
});

test("cada tipo tiene su título", () => {
  assert.equal(reportTitle("function_report"), "Informe de función");
  assert.equal(reportTitle("event_report"), "Informe del evento");
  assert.equal(reportTitle("weekly_report"), "Resumen semanal");
});
