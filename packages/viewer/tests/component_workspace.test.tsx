import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import { type ManifestComponent } from "../src/components/manifest_types.js";
import {
  controlDraft,
  validateControlDraft,
} from "../src/shell/component_control_fields.js";
import {
  workspaceData,
  type WorkspaceData,
  type WorkspaceVariant,
} from "../src/shell/workspace_data.js";
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

test("control drafts preserve primitive edits and emit typed overrides", () => {
  const component: ManifestComponent = {
    ...source,
    controls: {
      label: { kind: "text" },
      count: { kind: "number", minimum: -1, maximum: 10 },
      disabled: { kind: "boolean" },
      tone: {
        kind: "select",
        options: [
          { label: "Strong", value: "strong" },
          { label: "Quiet", value: "quiet" },
        ],
      },
      accent: {
        kind: "select",
        options: [
          { label: "Warm", value: "warm" },
          { label: "Cool", value: "cool" },
        ],
      },
      hint: { kind: "text" },
    },
    propSchema: {
      kind: "object",
      properties: {
        label: { schema: { kind: "string" } },
        count: { schema: { kind: "number", minimum: -1, maximum: 10 } },
        disabled: { schema: { kind: "boolean" } },
        tone: { schema: { kind: "enum", values: ["strong", "quiet"] } },
        accent: {
          optional: true,
          schema: { kind: "enum", values: ["warm", "cool"] },
        },
        hint: { optional: true, schema: { kind: "string" } },
      },
    },
  };
  const variant: WorkspaceVariant = {
    comparisonEligible: false,
    removed: false,
    value: {
      ...sourceVariant,
      props: encodeProps({
        label: "Continue",
        count: -0,
        disabled: true,
        tone: "quiet",
        hint: "Optional",
      }),
    },
  };
  const draft = controlDraft(component, variant);
  assert.deepEqual(draft, {
    label: { supplied: true, value: "Continue" },
    count: { supplied: true, value: "-0" },
    disabled: { supplied: true, value: true },
    tone: { supplied: true, value: "1" },
    accent: { supplied: false, value: "" },
    hint: { supplied: true, value: "Optional" },
  });

  const emptySelects = validateControlDraft(component, variant, {
    ...draft,
    tone: { supplied: true, value: "" },
    accent: { supplied: true, value: "" },
  });
  assert.equal(emptySelects.overrides, undefined);
  assert.equal(emptySelects.errors["tone"], "Choose an available value.");
  assert.equal(emptySelects.errors["accent"], "Choose an available value.");

  const invalid = validateControlDraft(component, variant, {
    ...draft,
    count: { supplied: true, value: "11" },
  });
  assert.equal(invalid.overrides, undefined);
  assert.equal(
    invalid.errors["count"],
    "Enter a number within the allowed range.",
  );

  const valid = validateControlDraft(component, variant, {
    ...draft,
    label: { supplied: true, value: "Purchase" },
    hint: { supplied: false, value: "Optional" },
  });
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.overrides, {
    label: { kind: "set", value: ["string", "Purchase"] },
    hint: { kind: "unset" },
  });
});

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
