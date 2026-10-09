import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import { type ManifestComponent } from "../src/components/manifest_types.js";
import {
  controlDraft,
  validateControlDraft,
} from "../src/shell/component_control_fields.js";
import { type WorkspaceVariant } from "../src/shell/workspace_data.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

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
