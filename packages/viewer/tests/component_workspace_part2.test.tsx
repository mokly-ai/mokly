import assert from "node:assert/strict";
import { test } from "node:test";

import { type ManifestComponentVariant } from "../src/components/manifest_types.js";
import { controlsUnavailable } from "../src/shell/component_controls_state.js";
import {
  workspaceData,
  type WorkspaceData,
  type WorkspaceVariant,
} from "../src/shell/workspace_data.js";
import { usageHref } from "../src/shell/workspace_usage.js";
import {
  resolveWorkspaceView,
  resolveWorkspaceViews,
  visibleWorkspaceViews,
} from "../src/shell/workspace_views.js";

import {
  catalogue,
  source,
  sourceVariant,
} from "./component_workspace_fixture.js";

test("workspace view selection uses exact contexts and light fallback", () => {
  const data = {
    ...workspaceData(catalogue, { base: "main", updateVersion: 0 }, source),
    views: [
      {
        viewport: "mobile",
        colorScheme: "light",
        path: "mobile-light.html",
        variantId: "action-default",
      },
      {
        viewport: "mobile",
        colorScheme: "dark",
        path: "mobile-dark.html",
        variantId: "action-default",
      },
      {
        viewport: "desktop",
        colorScheme: "light",
        path: "desktop-light.html",
        variantId: "action-default",
      },
    ],
  } satisfies WorkspaceData;
  assert.deepEqual(
    visibleWorkspaceViews(data, "action-default", "both", "dark").map(
      (view) => view.path,
    ),
    ["mobile-dark.html", "desktop-light.html"],
  );
  assert.deepEqual(
    visibleWorkspaceViews(data, "action-default", "desktop", "light").map(
      (view) => view.path,
    ),
    ["desktop-light.html"],
  );
  assert.deepEqual(
    resolveWorkspaceViews(data, "action-default", "both", "dark"),
    {
      colorScheme: "dark",
      views: [data.views[1], data.views[2]],
    },
  );
  const lightOnly = {
    ...data,
    views: data.views.filter(({ colorScheme }) => colorScheme === "light"),
  } satisfies WorkspaceData;
  assert.deepEqual(
    resolveWorkspaceViews(lightOnly, "action-default", "both", "dark"),
    {
      colorScheme: "light",
      views: lightOnly.views,
    },
  );
  const variant = data.variants.find(
    ({ value }) => value.id === "action-default",
  );
  assert.ok(variant);
  const mixedEvidence = {
    ...data,
    status: "Changed" as const,
    comparisonEligible: true,
    views: data.views.filter(({ colorScheme }) => colorScheme === "light"),
    viewStates: {
      "action-default": [
        {
          viewport: "mobile" as const,
          colorScheme: "light" as const,
          state: "unchanged" as const,
        },
        {
          viewport: "desktop" as const,
          colorScheme: "light" as const,
          state: "changed" as const,
        },
      ],
    },
  };
  const resolved = resolveWorkspaceView(
    mixedEvidence,
    { variant, comparisonEligible: true },
    "mobile",
    "dark",
  );
  assert.deepEqual(
    {
      colorScheme: resolved.colorScheme,
      comparisonEligible: resolved.comparisonEligible,
      evidence: resolved.evidence,
      paths: resolved.views.map(({ path }) => path),
      status: resolved.status,
    },
    {
      colorScheme: "light",
      comparisonEligible: false,
      evidence: "view",
      paths: ["mobile-light.html"],
      status: "Unmodified",
    },
  );

  assert.deepEqual(
    resolveWorkspaceView(
      { ...mixedEvidence, viewStates: {} },
      { variant, comparisonEligible: false },
      "mobile",
      "dark",
    ),
    {
      colorScheme: "light",
      comparisonEligible: false,
      evidence: "selection",
      status: "Unmodified",
      views: [mixedEvidence.views[0]!],
    },
  );

  assert.deepEqual(
    resolveWorkspaceView(
      {
        ...mixedEvidence,
        viewStates: {
          "action-default": [mixedEvidence.viewStates["action-default"][0]!],
        },
      },
      { variant, comparisonEligible: true },
      "both",
      "dark",
    ),
    {
      colorScheme: "light",
      comparisonEligible: true,
      evidence: "selection",
      status: "Unmodified",
      views: mixedEvidence.views,
    },
  );
});

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
