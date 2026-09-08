import assert from "node:assert/strict";
import test from "node:test";
import { formatCompactARS, formatCompactInteger } from "../src/lib/formatters.ts";

test("los importes abreviados nunca muestran cuatro dígitos de miles", () => {
  assert.equal(formatCompactARS(0), "$0");
  assert.equal(formatCompactARS(690_000), "$690k");
  assert.equal(formatCompactARS(949_000), "$949k");
  assert.equal(formatCompactARS(950_000), "$950k");
  assert.equal(formatCompactARS(999_499), "$999k");
  assert.equal(formatCompactARS(999_500), "$1,0M");
  assert.equal(formatCompactARS(1_715_000), "$1,7M");
  assert.equal(formatCompactARS(40_505_000), "$40,5M");
  assert.equal(formatCompactARS(121_645_250), "$121,6M");
});

test("las entradas abreviadas mantienen legible el rango chico", () => {
  assert.equal(formatCompactInteger(0), "0");
  assert.equal(formatCompactInteger(511), "511");
  assert.equal(formatCompactInteger(1_962), "1.962");
  assert.equal(formatCompactInteger(12_400), "12k");
});
