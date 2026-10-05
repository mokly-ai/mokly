import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import {
  branchPointModules,
  branchPointViolations,
  guardedBranchPointModule,
} from "./helpers/branch_point_guard.js";
import { repositoryRoot } from "./helpers/fixture.js";

/**
 * The catalogue data layer, projection, shell and embedded viewer use the
 * shared lookup for branch-point mappings. Reader validation checks raw input
 * before resolution. Registry preparation and move selection create inputs.
 */

function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
}

test("catalogue consumers map branch-point identities only through the lookup", async () => {
  const violations: string[] = [];
  for (const file of await branchPointModules())
    violations.push(
      ...branchPointViolations(
        parse(file, await fs.readFile(path.join(repositoryRoot, file), "utf8")),
        !file.startsWith("packages/viewer/src/shell/") &&
          !file.startsWith("packages/viewer/src/viewer/"),
      ),
    );
  assert.deepEqual(violations, []);
});

test("the guard recognizes each prohibited mapping and its permitted forms", () => {
  const rules = (text: string) =>
    branchPointViolations(parse("probe.ts", text)).map((item) =>
      item.replace(/^probe\.ts:\d+ /, ""),
    );
  assert.deepEqual(rules("catalogue.previousPaths.get(entry.path);"), [
    "reads previousPaths",
  ]);
  assert.deepEqual(rules("const { previousPaths } = catalogue;"), [
    "destructures a branch-point field",
  ]);
  assert.deepEqual(rules("entry.variantOf === parent.path;"), [
    "compares or follows variantOf",
  ]);
  assert.deepEqual(rules("byPath.get(entry?.variantOf);"), [
    "compares or follows variantOf",
  ]);
  assert.deepEqual(rules('entry["variantOf"] === path;'), [
    "compares or follows variantOf",
  ]);
  assert.deepEqual(rules("const { variantOf } = entry;"), [
    "destructures a branch-point field",
  ]);
  assert.deepEqual(rules("item.path.toLowerCase() === other;"), [
    "case-folds a path",
  ]);
  assert.deepEqual(rules("baselinePath.toLowerCase();"), ["case-folds a path"]);
  assert.deepEqual(rules("instance.componentId === component.path;"), [
    "matches a usage component name outside the lookup",
  ]);
  assert.deepEqual(rules("byPath.get(instance.componentId);"), [
    "indexes a usage component name outside the lookup",
  ]);
  assert.deepEqual(rules("retained.has(componentId);"), [
    "indexes a usage component name outside the lookup",
  ]);
  assert.deepEqual(
    rules(
      [
        "entry.variantOf === undefined;",
        "entry.variantOf !== undefined ? { variantOf: entry.variantOf } : {};",
        "typeof entry.variantOf;",
        '"variantOf" in entry;',
        "tag.toLowerCase();",
        "query.freeText.toLowerCase();",
        'lookup.usageComponent(instance.componentId, "before");',
      ].join("\n"),
    ),
    [],
  );
});

test("the guard selects the same lookup consumers with both separators", () => {
  for (const [file, expected] of [
    ["packages/viewer/src/catalogue/branch_point.ts", false],
    ["packages/viewer/src/catalogue/entry_selection.ts", true],
    ["packages/viewer/src/catalogue/references.ts", false],
    ["packages/viewer/src/catalogue/tree_validation.ts", false],
    ["packages/viewer/src/shell/workspace_props.tsx", true],
    ["packages/viewer/src/viewer/public_workspace.ts", true],
    ["src/catalogue/projection.ts", true],
    ["src/registry/entry_order.ts", true],
    ["src/registry/changes.ts", false],
  ] as const) {
    assert.equal(guardedBranchPointModule(file), expected, file);
    assert.equal(
      guardedBranchPointModule(file.split("/").join("\\")),
      expected,
      file,
    );
  }
});
