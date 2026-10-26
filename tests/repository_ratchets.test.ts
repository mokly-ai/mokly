import assert from "node:assert/strict";
import test from "node:test";

import {
  countPhysicalLines,
  internalExportAudit,
  typeScriptLengthFindings,
} from "../scripts/verification/repository-ratchets.mjs";

const lines = (count: number) => `${"line\n".repeat(count)}`;

test("physical line counts normalize CRLF without counting a final newline", () => {
  assert.equal(countPhysicalLines(""), 0);
  assert.equal(countPhysicalLines("one"), 1);
  assert.equal(countPhysicalLines("one\n"), 1);
  assert.equal(countPhysicalLines("one\r\ntwo\r\n"), 2);
});

test("source length ratchet rejects a new 301-line module", () => {
  assert.deepEqual(
    typeScriptLengthFindings([
      { path: "src/boundary.ts", current: lines(300) },
    ]),
    [],
  );
  assert.match(
    typeScriptLengthFindings([
      { path: "src/too_long.ts", current: lines(301) },
    ]).join("\n"),
    /src\/too_long\.ts.*301.*300/u,
  );
});

test("source length ratchet permits oversized shrinkage but rejects growth", () => {
  assert.deepEqual(
    typeScriptLengthFindings([
      {
        path: "src/legacy.ts",
        predecessorPath: "src/legacy.ts",
        previous: lines(310),
        current: lines(309),
      },
      {
        path: "src/unchanged.ts",
        predecessorPath: "src/unchanged.ts",
        previous: lines(310),
        current: lines(310),
      },
    ]),
    [],
  );
  assert.match(
    typeScriptLengthFindings([
      {
        path: "src/legacy.ts",
        predecessorPath: "src/legacy.ts",
        previous: lines(310),
        current: lines(311),
      },
    ]).join("\n"),
    /311.*310/u,
  );
  assert.match(
    typeScriptLengthFindings([
      {
        path: "src/crossed.ts",
        predecessorPath: "src/crossed.ts",
        previous: lines(300),
        current: lines(301),
      },
    ]).join("\n"),
    /301.*300/u,
  );
});

test("source length ratchet carries a Git-detected rename predecessor", () => {
  assert.deepEqual(
    typeScriptLengthFindings([
      {
        path: "src/renamed.ts",
        predecessorPath: "src/original.ts",
        previous: lines(305),
        current: lines(305),
      },
    ]),
    [],
  );
  assert.match(
    typeScriptLengthFindings([
      {
        path: "src/renamed.ts",
        predecessorPath: "src/original.ts",
        previous: lines(305),
        current: lines(306),
      },
    ]).join("\n"),
    /predecessor src\/original\.ts/u,
  );
});

test("internal export audit follows imports and public re-exports", () => {
  const result = internalExportAudit({
    modules: [
      {
        path: "src/api.ts",
        source: [
          "export const publicValue = 1;",
          "export const importedValue = 2;",
          "export class TypeCarrier {}",
          "export type TypeOnly = string;",
          "export default publicValue;",
        ].join("\n"),
      },
      {
        path: "src/consumer.ts",
        source: [
          'import { importedValue } from "./api.js";',
          'export type { TypeCarrier } from "./api.js";',
          "void importedValue;",
        ].join("\n"),
      },
      {
        path: "src/index.ts",
        source: 'export { publicValue } from "./api.js";',
      },
    ],
    publicEntrypoints: ["src/index.ts"],
    baseline: [],
  });
  assert.deepEqual(result.unused, []);
  assert.deepEqual(result.findings, []);
});

test("internal export audit resolves JavaScript imports", () => {
  const result = internalExportAudit({
    modules: [
      {
        path: "scripts/value.js",
        source: "export const importedValue = 1;",
      },
      {
        path: "scripts/consumer.mjs",
        source:
          'import { importedValue } from "./value.js";\nvoid importedValue;',
      },
    ],
    publicEntrypoints: [],
    baseline: [],
  });
  assert.deepEqual(result.unused, []);
  assert.deepEqual(result.findings, []);
});

test("internal export audit reads CommonJS named exports", () => {
  const result = internalExportAudit({
    modules: [
      {
        path: "scripts/value.cjs",
        source: "exports.importedValue = 1;\nmodule.exports.unusedValue = 2;",
      },
      {
        path: "scripts/consumer.mjs",
        source:
          'import { importedValue } from "./value.cjs";\nvoid importedValue;',
      },
    ],
    publicEntrypoints: [],
    baseline: [],
  });
  assert.deepEqual(result.unused, ["scripts/value.cjs#unusedValue"]);
  assert.match(result.findings.join("\n"), /new unused internal export/u);
});

test("internal export audit rejects a newly unused same-file export", () => {
  const result = internalExportAudit({
    modules: [
      {
        path: "src/internal.ts",
        source: "export const helper = 1;\nvoid helper;",
      },
    ],
    publicEntrypoints: [],
    baseline: [],
  });
  assert.deepEqual(result.unused, ["src/internal.ts#helper"]);
  assert.match(result.findings.join("\n"), /new unused internal export/u);
});

test("internal export baseline is exact, sorted, and shrinking", () => {
  const module = {
    path: "src/internal.ts",
    source: "export const helper = 1;",
  };
  assert.deepEqual(
    internalExportAudit({
      modules: [module],
      publicEntrypoints: [],
      baseline: ["src/internal.ts#helper"],
    }).findings,
    [],
  );
  assert.match(
    internalExportAudit({
      modules: [],
      publicEntrypoints: [],
      baseline: ["src/internal.ts#helper"],
    }).findings.join("\n"),
    /stale baseline.*src\/internal\.ts#helper/u,
  );
  assert.match(
    internalExportAudit({
      modules: [],
      publicEntrypoints: [],
      baseline: ["src/z.ts#z", "src/a.ts#a"],
    }).findings.join("\n"),
    /sorted/u,
  );
  assert.match(
    internalExportAudit({
      modules: [module],
      publicEntrypoints: [],
      baseline: ["src/internal.ts#helper"],
      baselineAtComparison: [],
    }).findings.join("\n"),
    /baseline entry was not present at the comparison commit.*src\/internal\.ts#helper/u,
  );
  assert.deepEqual(
    internalExportAudit({
      modules: [],
      publicEntrypoints: [],
      baseline: [],
      baselineAtComparison: ["src/internal.ts#helper"],
    }).findings,
    [],
  );
});
