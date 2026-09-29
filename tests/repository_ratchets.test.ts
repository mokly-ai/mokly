import assert from "node:assert/strict";
import test from "node:test";

import {
  countPhysicalLines,
  internalExportAudit,
  protocolCapFindings,
  typeScriptLengthFindings,
} from "../scripts/verification/repository-ratchets.mjs";

const lines = (count: number) => `${"line\n".repeat(count)}`;

test("physical line counts normalize CRLF without counting a final newline", () => {
  assert.equal(countPhysicalLines(""), 0);
  assert.equal(countPhysicalLines("one"), 1);
  assert.equal(countPhysicalLines("one\n"), 1);
  assert.equal(countPhysicalLines("one\r\ntwo\r\n"), 2);
});

test("TypeScript length ratchet rejects a new 301-line file", () => {
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

test("TypeScript length ratchet permits oversized shrinkage but rejects growth", () => {
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

test("TypeScript length ratchet carries a Git-detected rename predecessor", () => {
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

test("protocol cap ratchet rejects a raised cap", () => {
  const findings = protocolCapFindings({
    candidateDocuments: { "existing.md": lines(301) },
    candidateCaps: { "existing.md": 301 },
    baselineDocuments: { "existing.md": lines(300) },
    baselineCaps: { "existing.md": 300 },
  });
  assert.match(findings.join("\n"), /existing\.md.*301.*300/u);
});

test("protocol cap ratchet rejects new caps and stale cap lines", () => {
  const findings = protocolCapFindings({
    candidateDocuments: {
      "new.md": lines(251),
      "stale.md": lines(299),
    },
    candidateCaps: {
      "new.md": 251,
      "stale.md": 300,
    },
    baselineDocuments: { "stale.md": lines(300) },
    baselineCaps: { "stale.md": 300 },
  });
  assert.match(findings.join("\n"), /new\.md.*cannot add a cap/u);
  assert.match(findings.join("\n"), /stale\.md.*lower the cap to 299/u);
});

test("protocol cap bootstrap uses origin line counts and the variants rename", () => {
  assert.deepEqual(
    protocolCapFindings({
      candidateDocuments: { "mokly-variants.md": lines(269) },
      candidateCaps: { "mokly-variants.md": 269 },
      baselineDocuments: { "mokly-screen-variants.md": lines(270) },
      predecessors: {
        "mokly-variants.md": "mokly-screen-variants.md",
      },
    }),
    [],
  );
  assert.match(
    protocolCapFindings({
      candidateDocuments: { "mokly-variants.md": lines(271) },
      candidateCaps: { "mokly-variants.md": 271 },
      baselineDocuments: { "mokly-screen-variants.md": lines(270) },
      predecessors: {
        "mokly-variants.md": "mokly-screen-variants.md",
      },
    }).join("\n"),
    /mokly-variants\.md.*271.*270/u,
  );
});

test("protocol cap rename cannot turn an uncapped document into a capped one", () => {
  assert.match(
    protocolCapFindings({
      candidateDocuments: { "renamed.md": lines(251) },
      candidateCaps: { "renamed.md": 251 },
      baselineDocuments: { "original.md": lines(200) },
      predecessors: { "renamed.md": "original.md" },
    }).join("\n"),
    /renamed\.md.*cannot add a cap/u,
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
});
