import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { CLI_PACKAGE_PATH } from "../scripts/package/layout.mjs";
import { internalExportAudit } from "../scripts/verification/repository-ratchets.mjs";

const sourceRoot = path.posix.join(CLI_PACKAGE_PATH, "src");

test("internal export audit follows imports and public re-exports", () => {
  const result = internalExportAudit({
    modules: [
      {
        path: `${sourceRoot}/api.ts`,
        source: [
          "export const publicValue = 1;",
          "export const importedValue = 2;",
          "export class TypeCarrier {}",
          "export type TypeOnly = string;",
          "export default publicValue;",
        ].join("\n"),
      },
      {
        path: `${sourceRoot}/consumer.ts`,
        source: [
          'import { importedValue } from "./api.js";',
          'export type { TypeCarrier } from "./api.js";',
          "void importedValue;",
        ].join("\n"),
      },
      {
        path: `${sourceRoot}/index.ts`,
        source: 'export { publicValue } from "./api.js";',
      },
    ],
    publicEntrypoints: [`${sourceRoot}/index.ts`],
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
        path: `${sourceRoot}/internal.ts`,
        source: "export const helper = 1;\nvoid helper;",
      },
    ],
    publicEntrypoints: [],
    baseline: [],
  });
  assert.deepEqual(result.unused, [`${sourceRoot}/internal.ts#helper`]);
  assert.match(result.findings.join("\n"), /new unused internal export/u);
});

test("internal export baseline is exact, sorted, and shrinking", () => {
  const module = {
    path: `${sourceRoot}/internal.ts`,
    source: "export const helper = 1;",
  };
  assert.deepEqual(
    internalExportAudit({
      modules: [module],
      publicEntrypoints: [],
      baseline: [`${sourceRoot}/internal.ts#helper`],
    }).findings,
    [],
  );
  assert.match(
    internalExportAudit({
      modules: [],
      publicEntrypoints: [],
      baseline: [`${sourceRoot}/internal.ts#helper`],
    }).findings.join("\n"),
    /stale baseline.*src\/internal\.ts#helper/u,
  );
  assert.match(
    internalExportAudit({
      modules: [],
      publicEntrypoints: [],
      baseline: [`${sourceRoot}/z.ts#z`, `${sourceRoot}/a.ts#a`],
    }).findings.join("\n"),
    /sorted/u,
  );
  assert.match(
    internalExportAudit({
      modules: [module],
      publicEntrypoints: [],
      baseline: [`${sourceRoot}/internal.ts#helper`],
      baselineAtComparison: [],
    }).findings.join("\n"),
    /baseline entry was not present at the comparison commit.*src\/internal\.ts#helper/u,
  );
  assert.deepEqual(
    internalExportAudit({
      modules: [],
      publicEntrypoints: [],
      baseline: [],
      baselineAtComparison: [`${sourceRoot}/internal.ts#helper`],
    }).findings,
    [],
  );
});
