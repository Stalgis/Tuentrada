import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPendingDestination,
  peekPendingDestination,
  setPendingDestination,
  subscribeToPendingDestination,
  takePendingDestination,
} from "../src/lib/pendingNotification.ts";

const destination = { type: "function_report", reportId: "rep_1", functionId: "fn_1" };

test("el destino se consume una sola vez", () => {
  setPendingDestination(destination);
  assert.deepEqual(peekPendingDestination(), destination);
  assert.deepEqual(takePendingDestination(), destination);
  // Un remonte posterior del stack no debe reabrir el mismo informe.
  assert.equal(takePendingDestination(), null);
});

test("cerrar sesión descarta el destino pendiente", () => {
  setPendingDestination(destination);
  clearPendingDestination();
  assert.equal(takePendingDestination(), null);
});

test("avisa a quien esté escuchando cuando llega un destino", () => {
  let avisos = 0;
  const unsubscribe = subscribeToPendingDestination(() => {
    avisos += 1;
  });

  setPendingDestination(destination);
  assert.equal(avisos, 1);

  clearPendingDestination();
  assert.equal(avisos, 2);

  // Sin destino pendiente no hay nada que avisar.
  clearPendingDestination();
  assert.equal(avisos, 2);

  unsubscribe();
  setPendingDestination(destination);
  assert.equal(avisos, 2);

  takePendingDestination();
});
