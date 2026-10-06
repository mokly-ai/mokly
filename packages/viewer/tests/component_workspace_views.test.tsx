import assert from "node:assert/strict";
import { test } from "node:test";

import { readCurrentPath } from "../src/catalogue/path_values.js";
import {
  workspaceData,
  type WorkspaceData,
} from "../src/shell/workspace_data.js";
import {
  resolveWorkspaceView,
  resolveWorkspaceViews,
  visibleWorkspaceViews,
} from "../src/shell/workspace_views.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { catalogue, source } = componentWorkspaceFixture();

test("workspace view selection uses exact contexts and light fallback", () => {
  const data = {
    ...workspaceData(catalogue, { base: "main", updateVersion: 0 }, source),
    views: [
      {
        viewport: "mobile",
        colorScheme: "light",
        path: "mobile-light.html",
        variantPath: readCurrentPath("components/action/default"),
      },
      {
        viewport: "mobile",
        colorScheme: "dark",
        path: "mobile-dark.html",
        variantPath: readCurrentPath("components/action/default"),
      },
      {
        viewport: "desktop",
        colorScheme: "light",
        path: "desktop-light.html",
        variantPath: readCurrentPath("components/action/default"),
      },
    ],
  } satisfies WorkspaceData;
  assert.deepEqual(
    visibleWorkspaceViews(
      data,
      "components/action/default",
      "both",
      "dark",
    ).map((view) => view.path),
    ["mobile-dark.html", "desktop-light.html"],
  );
  assert.deepEqual(
    visibleWorkspaceViews(
      data,
      "components/action/default",
      "desktop",
      "light",
    ).map((view) => view.path),
    ["desktop-light.html"],
  );
  assert.deepEqual(
    resolveWorkspaceViews(data, "components/action/default", "both", "dark"),
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
    resolveWorkspaceViews(
      lightOnly,
      "components/action/default",
      "both",
      "dark",
    ),
    {
      colorScheme: "light",
      views: lightOnly.views,
    },
  );
  const variant = data.variants.find(
    ({ value }) => value.path === "components/action/default",
  );
  assert.ok(variant);
  const mixedEvidence = {
    ...data,
    status: "Changed" as const,
    comparisonEligible: true,
    views: data.views.filter(({ colorScheme }) => colorScheme === "light"),
    viewStates: {
      "components/action/default": [
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
          "components/action/default": [
            mixedEvidence.viewStates["components/action/default"][0]!,
          ],
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
