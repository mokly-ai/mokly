import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { typedBranchPointViolations } from "./helpers/branch_point_type_guard.js";
import { checkBranchPointSample } from "./helpers/branch_point_type_program.js";
import {
  branchPointTypeProgram,
  guardedTypedBranchPointModule,
} from "./helpers/branch_point_type_scope.js";
import { repositoryRoot } from "./helpers/fixture.js";

const types = `
import type { CurrentPath, BranchPointPath } from "../packages/viewer/src/catalogue/path_types.js";
import type { AffectedUsageEvidence } from "../packages/viewer/src/review/component_types.js";
declare const before: BranchPointPath;
declare const current: CurrentPath;
declare const currentEntriesById: Map<CurrentPath, { path: CurrentPath }>;
declare const candidates: { path: CurrentPath }[];
declare const paths: CurrentPath[];
`;

test("the compiler rejects direct cross-side comparisons and keys", () => {
  const sample = checkBranchPointSample(`${types}
before === current;
currentEntriesById.get(before);
paths.includes(before);
`);
  assert.deepEqual(sample.diagnostics, [2367, 2345, 2345]);
});

test("the typed guard rejects the former affected usage matches", () => {
  const sample = checkBranchPointSample(`${types}
declare const evidence: AffectedUsageEvidence<CurrentPath, BranchPointPath>;
if (evidence.side === "before") {
  const entryId = evidence.context.entry.path;
  currentEntriesById.get(entryId);
  candidates.find(candidate => candidate.path === entryId);
}
`);
  assert.equal(sample.violations.length, 2);
});

test("the typed guard rejects string and collection escape routes", () => {
  for (const text of [
    "new Map<string, number>().get(before);",
    "new Set<string>().has(before);",
    "candidates.find(candidate => candidate.path === before);",
    "before.toLowerCase() === current.toLowerCase();",
    "const fold = before.toLowerCase; fold();",
    "before as string;",
    "before as any;",
    "before as unknown as CurrentPath;",
    "String(before);",
    "const convert = String; convert(before);",
    "const erased: string = before;",
    "function address(): string { return before; }",
    "const key = `${before}`; currentEntriesById.get(key as CurrentPath);",
    'const key = "entry:" + before;',
    "const index: Record<string, number> = {}; index[before];",
    "new Map<string, number>([[before, 1]]);",
    "const wrapped: { path: string } = { path: before };",
    "const wrapped = { path: before }; wrapped.path === current;",
    "new Map<BranchPointPath, number>().get(current as any);",
    'import { readBranchPointPath } from "../packages/viewer/src/catalogue/path_values.js"; readBranchPointPath(current);',
    'import { readBranchPointPath } from "../packages/viewer/src/catalogue/path_values.js"; const text: string = current; readBranchPointPath(text);',
    'import { readBranchPointPath } from "../packages/viewer/src/catalogue/path_values.js"; readBranchPointPath(current.toLowerCase());',
  ]) {
    assert.ok(
      checkBranchPointSample(`${types}\n${text}`).violations.length,
      text,
    );
  }
});

test("the typed guard accepts sided lookup inputs and same-side keys", () => {
  for (const text of [
    "before === before;",
    "currentEntriesById.get(current);",
    "new Map<BranchPointPath, number>().get(before);",
    "const reference = { kind: 'screen' as const, path: before, side: 'before' as const }; lookup.resolve(reference);",
    "lookup.counterpart({ kind: 'screen', path: current })?.path === before;",
    "const reference = before; reference === before;",
  ]) {
    const sample = checkBranchPointSample(`${types}
import type { BranchPointLookup } from "../packages/viewer/src/catalogue/branch_point_types.js";
declare const lookup: BranchPointLookup;
${text}`);
    assert.deepEqual(sample.diagnostics, [], text);
    assert.deepEqual(sample.violations, [], text);
  }
});

test("data consumers preserve reference sides outside the lookup", () => {
  const program = branchPointTypeProgram();
  const violations = program
    .getSourceFiles()
    .flatMap((source) =>
      guardedTypedBranchPointModule(
        path.relative(repositoryRoot, source.fileName),
      )
        ? typedBranchPointViolations(source, program.getTypeChecker())
        : [],
    );
  assert.deepEqual(violations, []);
});

test("typed guard file selection uses either separator", () => {
  for (const file of [
    "src/catalogue/projection.ts",
    "packages/viewer/src/catalogue/entry_selection.ts",
    "packages/viewer/src/catalogue/path_values.ts",
    "packages/viewer/src/catalogue/references.ts",
    "packages/viewer/src/shell/workspace_usage_data.ts",
    "packages/viewer/src/viewer/projection.ts",
    "packages/viewer/src/review/result_branch_points.ts",
  ]) {
    for (const shell of [false, true])
      assert.equal(
        guardedTypedBranchPointModule(file, shell),
        guardedTypedBranchPointModule(file.split("/").join("\\"), shell),
        file,
      );
  }
});
