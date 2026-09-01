import assert from "node:assert/strict";
import test from "node:test";
import { formatAppVersion, UNKNOWN_VERSION } from "../src/lib/appVersion.ts";

test("muestra versión y build cuando están los dos", () => {
  assert.equal(formatAppVersion({ version: "1.2.2", buildNumber: "47" }), "1.2.2 (47)");
  // Android entrega el versionCode como número.
  assert.equal(formatAppVersion({ version: "1.2.2", buildNumber: 47 }), "1.2.2 (47)");
});

test("un versionCode 0 se muestra, no se descarta por falsy", () => {
  assert.equal(formatAppVersion({ version: "1.2.2", buildNumber: 0 }), "1.2.2 (0)");
});

test("sin build queda sólo la versión", () => {
  for (const buildNumber of [null, undefined, "", "   ", NaN]) {
    assert.equal(
      formatAppVersion({ version: "1.2.2", buildNumber }),
      "1.2.2",
      `buildNumber ${String(buildNumber)}`,
    );
  }
});

test("en Expo Go no se muestra el build, que es el de Expo", () => {
  assert.equal(formatAppVersion({ version: "1.2.2", buildNumber: "999", isExpoGo: true }), "1.2.2 · Expo Go");
});

test("sin versión no se inventa un número", () => {
  assert.equal(formatAppVersion({}), UNKNOWN_VERSION);
  assert.equal(formatAppVersion({ version: null, buildNumber: "47" }), UNKNOWN_VERSION);
  assert.equal(formatAppVersion({ version: "  " }), UNKNOWN_VERSION);
});

test("recorta los espacios que puedan venir del config", () => {
  assert.equal(formatAppVersion({ version: " 1.2.2 ", buildNumber: " 47 " }), "1.2.2 (47)");
});
