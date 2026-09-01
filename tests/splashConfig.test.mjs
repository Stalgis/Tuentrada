import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SPLASH, readSplashConfig } from "../src/lib/splashConfig.ts";
import { readFileSync } from "node:fs";

test("lee el fondo y el ancho del bloque del plugin", () => {
  const plugins = [
    "expo-secure-store",
    ["expo-splash-screen", { image: "./x.png", imageWidth: 220, backgroundColor: "#021f79" }],
  ];
  assert.deepEqual(readSplashConfig(plugins), { backgroundColor: "#021f79", imageWidth: 220 });
});

test("cae en los valores por defecto cuando falta o viene incompleto", () => {
  assert.deepEqual(readSplashConfig(undefined), DEFAULT_SPLASH);
  assert.deepEqual(readSplashConfig([]), DEFAULT_SPLASH);
  assert.deepEqual(readSplashConfig(["expo-font"]), DEFAULT_SPLASH);
  // Forma sin opciones: el plugin declarado como string suelto.
  assert.deepEqual(readSplashConfig(["expo-splash-screen"]), DEFAULT_SPLASH);
  // Opciones presentes pero con tipos que no sirven.
  assert.deepEqual(
    readSplashConfig([["expo-splash-screen", { backgroundColor: "", imageWidth: 0 }]]),
    DEFAULT_SPLASH,
  );
  assert.deepEqual(
    readSplashConfig([["expo-splash-screen", { backgroundColor: 123, imageWidth: "220" }]]),
    DEFAULT_SPLASH,
  );
});

test("lo que lee coincide con lo que hay en app.json", () => {
  // Si alguien cambia el splash en app.json, este test sigue pasando: es el
  // punto. Lo que verifica es que el parser entiende la forma real del archivo
  // y no una inventada para el test.
  const appJson = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
  const fromConfig = readSplashConfig(appJson.expo.plugins);
  const plugin = appJson.expo.plugins.find(
    (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
  );
  assert.ok(plugin, "app.json tiene que declarar expo-splash-screen con opciones");
  assert.equal(fromConfig.backgroundColor, plugin[1].backgroundColor);
  assert.equal(fromConfig.imageWidth, plugin[1].imageWidth);
});
