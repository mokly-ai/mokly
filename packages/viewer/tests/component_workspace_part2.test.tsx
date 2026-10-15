import assert from "node:assert/strict";
import { test } from "node:test";

import { type ManifestComponentVariant } from "../src/components/manifest_types.js";
import { controlsUnavailable } from "../src/shell/component_controls_state.js";
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
  assert.equal(
    controlsUnavailable(target, true, true),
    "Comparisons show the saved props. Return to Current to edit props.",
  );
  assert.equal(
    controlsUnavailable(target, false, false),
    "Open this catalogue locally to edit props.",
  );
  assert.equal(controlsUnavailable(target, false, true), undefined);
  for (const unavailable of [undefined, { ...target, removed: true }])
    assert.equal(
      controlsUnavailable(unavailable, false, true),
      "Choose an available entry to edit props.",
    );
  assert.equal(
    controlsUnavailable({ ...target, controls: {} }, false, true),
    "No editable props are declared for this entry.",
  );
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
