import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthCredentialsError,
  AuthResponseError,
  AuthServerError,
  authErrorForStatus,
} from "../src/lib/authErrors.ts";

test("solo 401 y 403 representan credenciales rechazadas", () => {
  assert.ok(authErrorForStatus(401, "Unauthorized") instanceof AuthCredentialsError);
  assert.ok(authErrorForStatus(403, "Forbidden") instanceof AuthCredentialsError);
  assert.ok(authErrorForStatus(422, "Invalid") instanceof AuthResponseError);
});

test("un 500 no se clasifica como credenciales inválidas", () => {
  const error = authErrorForStatus(500, "Internal Server Error");
  assert.ok(error instanceof AuthServerError);
  assert.equal(error.status, 500);
  assert.equal(error instanceof AuthCredentialsError, false);
});

test("una respuesta exitosa no produce error", () => {
  assert.equal(authErrorForStatus(200, "OK"), null);
});
