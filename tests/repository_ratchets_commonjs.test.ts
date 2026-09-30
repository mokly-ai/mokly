import assert from "node:assert/strict";
import test from "node:test";

import { internalExportAudit } from "../scripts/verification/repository-ratchets.mjs";

test("destructured and property require calls use only named exports", () => {
  const destructured = audit(
    "scripts/provider.cjs",
    "exports.first = 1;\nexports.second = 2;\n",
    'const { first: local } = require("./provider.cjs");\nvoid local;\n',
  );
  assert.deepEqual(destructured.unused, ["scripts/provider.cjs#second"]);
  assert.match(destructured.findings.join("\n"), /#second/u);

  const properties = audit(
    "scripts/provider.cjs",
    "exports.first = 1;\nexports.second = 2;\n",
    [
      'void require("./provider.cjs").first;',
      'void require("./provider.cjs")["second"];',
    ].join("\n"),
  );
  assert.deepEqual(properties.unused, []);
  assert.deepEqual(properties.findings, []);
});

test("whole require bindings and import-equals use every export", () => {
  for (const consumer of [
    'const provider = require("./provider.cjs");\nvoid provider;',
    'import provider = require("./provider.cjs");\nvoid provider;',
  ]) {
    const result = audit(
      "scripts/provider.cjs",
      "module.exports = { first: 1, second: 2 };\n",
      consumer,
    );
    assert.deepEqual(result.unused, []);
    assert.deepEqual(result.findings, []);
  }
});

test("bare and non-literal require calls do not claim exports", () => {
  for (const consumer of [
    'require("./provider.cjs");',
    'const specifier = "./provider.cjs";\nconst provider = require(specifier);',
  ]) {
    const result = audit(
      "scripts/provider.cjs",
      "exports.first = 1;\nexports.second = 2;\n",
      consumer,
    );
    assert.deepEqual(result.unused, [
      "scripts/provider.cjs#first",
      "scripts/provider.cjs#second",
    ]);
    assert.match(result.findings.join("\n"), /new unused internal export/u);
  }
});

test("default imports use CommonJS exports but not ES module named exports", () => {
  const commonJs = audit(
    "scripts/provider.js",
    "exports.first = 1;\nmodule.exports.second = 2;\n",
    'import provider from "./provider.js";\nvoid provider;',
  );
  assert.deepEqual(commonJs.unused, []);

  const extensionCommonJs = audit(
    "scripts/provider.cts",
    "export const first = 1;\nexport const second = 2;\n",
    'import provider from "./provider.cjs";\nvoid provider;',
  );
  assert.deepEqual(extensionCommonJs.unused, []);

  const esModule = audit(
    "scripts/provider.ts",
    "export default 0;\nexport const first = 1;\nexport const second = 2;\n",
    'import provider from "./provider.js";\nvoid provider;',
  );
  assert.deepEqual(esModule.unused, [
    "scripts/provider.ts#first",
    "scripts/provider.ts#second",
  ]);
  assert.match(esModule.findings.join("\n"), /new unused internal export/u);
});

test("dynamic imports distinguish whole-object and named use", () => {
  const whole = audit(
    "scripts/provider.ts",
    "export const first = 1;\nexport const second = 2;\n",
    'const provider = await import("./provider.js");\nvoid provider;',
  );
  assert.deepEqual(whole.unused, []);

  const named = audit(
    "scripts/provider.ts",
    "export const first = 1;\nexport const second = 2;\nexport const third = 3;\n",
    [
      'const { first, second: local } = await import("./provider.js");',
      'void (await import("./provider.js")).third;',
      "void first;",
      "void local;",
    ].join("\n"),
  );
  assert.deepEqual(named.unused, []);
});

test("non-literal dynamic imports leave exports reportably unused", () => {
  const result = audit(
    "scripts/provider.ts",
    "export const first = 1;\n",
    'const specifier = "./provider.js";\nconst provider = await import(specifier);\nvoid provider;',
  );
  assert.deepEqual(result.unused, ["scripts/provider.ts#first"]);
  assert.match(result.findings.join("\n"), /#first/u);
});

function audit(providerPath: string, provider: string, consumer: string) {
  return internalExportAudit({
    modules: [
      { path: providerPath, source: provider },
      { path: "scripts/consumer.ts", source: consumer },
    ],
    publicEntrypoints: [],
    baseline: [],
  });
}
