import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import {
  type ManifestComponent,
  type ManifestComponentVariant,
} from "../src/components/manifest_types.js";
import {
  controlDraft,
  validateControlDraft,
} from "../src/shell/component_control_fields.js";
import { controlsUnavailable } from "../src/shell/component_controls_state.js";
import {
  type WorkspaceData,
  type WorkspaceVariant,
} from "../src/shell/workspace_data.js";
import { usageHref } from "../src/shell/workspace_usage.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";
import { currentManifestEntryFixture } from "./manifest_path_fixture.js";

const { source, sourceVariant } = componentWorkspaceFixture();

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
  const draft = controlDraft(currentManifestEntryFixture(component), variant);
  assert.deepEqual(draft, {
    label: { supplied: true, value: "Continue" },
    count: { supplied: true, value: "-0" },
    disabled: { supplied: true, value: true },
    tone: { supplied: true, value: "1" },
    accent: { supplied: false, value: "" },
    hint: { supplied: true, value: "Optional" },
  });

  const emptySelects = validateControlDraft(
    currentManifestEntryFixture(component),
    variant,
    {
      ...draft,
      tone: { supplied: true, value: "" },
      accent: { supplied: true, value: "" },
    },
  );
  assert.equal(emptySelects.overrides, undefined);
  assert.equal(emptySelects.errors["tone"], "Choose an available value.");
  assert.equal(emptySelects.errors["accent"], "Choose an available value.");

  const invalid = validateControlDraft(
    currentManifestEntryFixture(component),
    variant,
    {
      ...draft,
      count: { supplied: true, value: "11" },
    },
  );
  assert.equal(invalid.overrides, undefined);
  assert.equal(
    invalid.errors["count"],
    "Enter a number within the allowed range.",
  );

  const valid = validateControlDraft(
    currentManifestEntryFixture(component),
    variant,
    {
      ...draft,
      label: { supplied: true, value: "Purchase" },
      hint: { supplied: false, value: "Optional" },
    },
  );
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.overrides, {
    label: { kind: "set", value: ["string", "Purchase"] },
    hint: { kind: "unset" },
  });
});

test("control availability and usage URLs explain the active product state", () => {
  const variant = {
    comparisonEligible: false,
    removed: false,
    value: currentManifestEntryFixture(
      sourceVariant as ManifestComponentVariant,
    ),
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
      entryId: "product/browse/home",
      entryKind: "screen",
      viewport: "mobile",
      colorScheme: "dark",
      instanceKey: "a".repeat(64),
      direct: true,
      removed: true,
      comparisonEligible: true,
    }),
    `/view/product/browse/home/?viewport=mobile&scheme=dark&instance=${"a".repeat(64)}&comparison=side`,
  );
});
