import assert from "node:assert/strict";
import { test } from "node:test";

import { type ManifestComponentVariant } from "../src/components/manifest_types.js";
import { controlsMode } from "../src/shell/component_controls_state.js";
import { controlTarget } from "../src/shell/control_values.js";
import { type WorkspaceVariant } from "../src/shell/workspace_data.js";
import { usageHref } from "../src/shell/workspace_usage.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { source, sourceVariant } = componentWorkspaceFixture();

test("control availability and usage URLs explain the active product state", () => {
  const variant = {
    comparisonEligible: false,
    removed: false,
    value: sourceVariant as ManifestComponentVariant,
  } satisfies WorkspaceVariant;
  const target = controlTarget(source, variant, false);
  assert.ok(target);
  assert.equal(target.title, sourceVariant.title);
  assert.equal(controlsMode(target, true, "ready"), "comparison");
  assert.equal(controlsMode(target, false, undefined), "published");
  assert.equal(controlsMode(target, false, "preparing"), "preparing");
  assert.equal(controlsMode(target, false, "ready"), "editable");
  const removed = controlTarget(source, { ...variant, removed: true }, false);
  assert.ok(removed);
  assert.equal(controlsMode(removed, false, "ready"), "removed");
  assert.equal(
    usageHref({
      title: "Home",
      entryId: "home",
      entryKind: "screen",
      viewport: "mobile",
      colorScheme: "dark",
      instanceKey: "a".repeat(64),
      direct: true,
      removed: true,
      comparisonEligible: true,
    }),
    `/view/home/?viewport=mobile&scheme=dark&instance=${"a".repeat(64)}&comparison=side`,
  );
});
