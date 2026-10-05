import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  workspaceData,
  type WorkspaceData,
} from "../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../packages/viewer/dist/shell/workspace_evidence.js";

import {
  movedComponentEvidence,
  routed,
} from "./helpers/moved_component_evidence.js";

const unmodified = {
  base: "main",
  status: "Unmodified",
  components: [],
  comparisonEligible: false,
  comparisons: true,
  entry: { path: "account/receipt", kind: "screen" },
  inputChanges: [],
  relatedComponents: [],
  usedBy: [],
  affected: [],
  removed: false,
  variants: [],
  views: [],
} as unknown as WorkspaceData;

test("a moved entry's comparison details name the path its earlier side comes from", () => {
  const moved = renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data: unmodified,
      previousPath: "billing/receipt",
    }),
  );
  assert.match(
    moved,
    /<p>Compared with the branch point on main\.<\/p><p>The previous version is at <code class="mbk-code">billing\/receipt<\/code>, where it was before the move\.<\/p><p>No changes to this screen\.<\/p><\/section>$/u,
  );
  const stayed = renderToStaticMarkup(
    createElement(WorkspaceEvidence, { data: unmodified }),
  );
  assert.doesNotMatch(stayed, /before the move/u);
});

const { catalogue, context } = movedComponentEvidence();
const open = (path: string) =>
  workspaceData(catalogue, context, routed(catalogue, path));
const rows = (data: WorkspaceData) =>
  data.variants.map(({ value, status, removed }) => [
    value.path,
    status,
    removed,
  ]);
const ACTION_ROWS = [
  ["ui/action/primary", "Unmodified", false],
  ["ui/action/ghost", "Changed", false],
  ["ui/action/iconic", "Changed", false],
  ["components/action/secondary", "Removed", true],
];

test("a moved component's variants read their own changes, never the move", () => {
  assert.deepEqual(rows(open("ui/action/ghost")), ACTION_ROWS);
  assert.equal(open("ui/action/ghost").status, "Changed");
  assert.equal(open("ui/action/primary").status, "Unmodified");
});

test("a variant deleted during its parent's move opens with that parent's workspace", () => {
  const data = open("components/action/secondary");
  assert.equal(data.component?.path, "ui/action");
  assert.equal(data.status, "Removed");
  assert.deepEqual(rows(data), ACTION_ROWS);
});

test("a moved variant pairs its views and nested instances through the move", () => {
  assert.deepEqual(
    open("ui/action/iconic").inputChanges.map((change) => [
      change.title,
      change.instanceId,
      change.viewport,
      change.variantPath,
      change.before,
      change.after,
    ]),
    (["mobile", "desktop"] as const).map((viewport) => [
      "Icon",
      "glyph",
      viewport,
      "ui/action/iconic",
      { name: ["string", "arrow"] },
      { name: ["string", "chevron"] },
    ]),
  );
});
