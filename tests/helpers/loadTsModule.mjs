import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const nativeRequire = createRequire(import.meta.url);
/** Ejecuta el módulo real, sustituyendo únicamente sus adaptadores nativos. */
export const loadTsModule = (path, mocks) => {
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const execute = vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: path });
  execute(name => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name), module, module.exports);
  return module.exports;
};
