import assert from "node:assert/strict";
import test from "node:test";

import { checkBranchPointSample } from "./helpers/branch_point_type_program.js";

test("shell addresses and baseline evidence retain distinct path types", () => {
  const sample = checkBranchPointSample(`
import type { Catalogue } from "../packages/viewer/src/shell/catalogue.js";
import type { ShellEvidence } from "../packages/viewer/src/shell/metadata.js";
declare const catalogue: Catalogue;
declare const evidence: ShellEvidence;
const current = catalogue.manifest.entries[0]!.path;
const before = evidence.baseline.entries[0]!.path;
current === before;
catalogue.byPath.get(before);
`);
  assert.deepEqual(sample.diagnostics, [2367, 2345]);
});

test("display and generated view helpers preserve historical usage types", () => {
  const sample = checkBranchPointSample(`
import type { CurrentPath, BranchPointPath } from "../packages/viewer/src/catalogue/path_types.js";
import type { ShellCatalogueVariant } from "../packages/viewer/src/catalogue/scoped_types.js";
import { generatedViews, orderedInstances } from "../packages/viewer/src/components/views.js";
import { displayEntry } from "../packages/viewer/src/viewer/projection.js";
declare const removed: ShellCatalogueVariant<CurrentPath, BranchPointPath>;
declare const current: CurrentPath;
const entry = displayEntry(removed);
if (entry.kind === "component" && "variantOf" in entry) {
  entry.variantOf === current;
  const view = generatedViews(entry)[0]!;
  orderedInstances(view.usage)[0]!.componentId === current;
}
`);
  assert.deepEqual(sample.diagnostics, [2367, 2367]);
});

test("lookup entry relationships retain branch-point types", () => {
  const sample = checkBranchPointSample(`
import type { BranchPointEntry } from "../packages/viewer/src/catalogue/branch_point_types.js";
import type { CurrentPath } from "../packages/viewer/src/catalogue/path_types.js";
declare const entry: BranchPointEntry;
declare const current: CurrentPath;
entry.previousPath === current;
`);
  assert.deepEqual(sample.diagnostics, [2367]);
});
