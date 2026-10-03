import assert from "node:assert/strict";
import { test } from "node:test";

import { type ManifestComponentVariant } from "../src/components/manifest_types.js";
import { controlsUnavailable } from "../src/shell/component_controls_state.js";
import {
  type WorkspaceData,
  type WorkspaceVariant,
} from "../src/shell/workspace_data.js";
import { usageHref } from "../src/shell/workspace_usage.js";

import { source, sourceVariant } from "./component_workspace_fixture.js";

test("control availability and usage URLs explain the active product state", () => {
  const variant = {
    comparisonEligible: false,
    removed: false,
    value: sourceVariant as ManifestComponentVariant,
  } satisfies WorkspaceVariant;
  const data = {
    entry: source,
  } as WorkspaceData;
  assert.equal(
    controlsUnavailable(data, variant, true, true),
    "Comparisons show the saved variant. Return to Current to edit props.",
  );
  assert.equal(
    controlsUnavailable(data, variant, false, false),
    "Open this catalogue locally to edit props.",
  );
  assert.equal(controlsUnavailable(data, variant, false, true), undefined);
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
    `/view/screens/home.html?viewport=mobile&scheme=dark&instance=${"a".repeat(64)}&comparison=side`,
  );
});
