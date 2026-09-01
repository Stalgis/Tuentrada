import assert from "node:assert/strict";
import test from "node:test";
import {
  getUpdateStatus,
  nextUpdateAction,
  shouldShowUpdateSection,
} from "../src/lib/appUpdate.ts";

const flags = (overrides = {}) => ({
  isEnabled: true,
  isChecking: false,
  isDownloading: false,
  isRestarting: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
  checkError: null,
  downloadError: null,
  hasChecked: false,
  ...overrides,
});

test("sin expo-updates activo el bloque no se muestra", () => {
  const status = getUpdateStatus(flags({ isEnabled: false, isUpdateAvailable: true }));
  assert.equal(status, "disabled");
  assert.equal(shouldShowUpdateSection(status), false);
  assert.equal(nextUpdateAction(status), "none");
});

test("antes de comprobar nada, el botón ofrece buscar", () => {
  const status = getUpdateStatus(flags());
  assert.equal(status, "idle");
  assert.equal(nextUpdateAction(status), "check");
});

test("comprobación sin novedades", () => {
  const status = getUpdateStatus(flags({ hasChecked: true }));
  assert.equal(status, "upToDate");
  assert.equal(nextUpdateAction(status), "check");
});

test("hay actualización: el botón la descarga", () => {
  const status = getUpdateStatus(flags({ hasChecked: true, isUpdateAvailable: true }));
  assert.equal(status, "available");
  assert.equal(nextUpdateAction(status), "download");
});

test("descargada: el botón reinicia", () => {
  const status = getUpdateStatus(flags({ isUpdateAvailable: true, isUpdatePending: true }));
  assert.equal(status, "ready");
  assert.equal(nextUpdateAction(status), "restart");
});

test("los estados en curso ganan sobre el resultado anterior", () => {
  assert.equal(getUpdateStatus(flags({ isChecking: true, hasChecked: true })), "checking");
  assert.equal(
    getUpdateStatus(flags({ isDownloading: true, isUpdateAvailable: true })),
    "downloading",
  );
  assert.equal(getUpdateStatus(flags({ isRestarting: true, isUpdatePending: true })), "restarting");
  // Mientras algo corre, el botón no ofrece acción.
  for (const s of ["checking", "downloading", "restarting"]) {
    assert.equal(nextUpdateAction(s), "none", s);
  }
});

test("una descarga terminada gana sobre un error anterior", () => {
  // El usuario ya tiene la actualización en el dispositivo: mostrarle un error
  // y esconderle el botón de reiniciar lo dejaría trabado.
  const status = getUpdateStatus(
    flags({ isUpdatePending: true, downloadError: new Error("timeout"), checkError: new Error("red") }),
  );
  assert.equal(status, "ready");
  assert.equal(nextUpdateAction(status), "restart");
});

test("un error de descarga pesa más que la disponibilidad", () => {
  // Si falló la descarga, decir "hay una actualización" esconde el problema.
  const status = getUpdateStatus(
    flags({ isUpdateAvailable: true, downloadError: new Error("sin espacio") }),
  );
  assert.equal(status, "error");
  assert.equal(nextUpdateAction(status), "check");
});

test("un error de comprobación no tapa una actualización ya encontrada", () => {
  const status = getUpdateStatus(flags({ isUpdateAvailable: true, checkError: new Error("red") }));
  assert.equal(status, "available");
});

test("error de comprobación sin nada encontrado", () => {
  const status = getUpdateStatus(flags({ checkError: new Error("red"), hasChecked: true }));
  assert.equal(status, "error");
  assert.equal(nextUpdateAction(status), "check");
});
