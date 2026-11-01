import assert from "node:assert/strict";
import { test } from "node:test";

import type { ShellCatalogueComponent } from "../src/catalogue/scoped_types.js";
import { encodeProps } from "../src/components/codec.js";
import {
  controlDraft,
  validateControlDraft,
} from "../src/shell/component_control_fields.js";
import { controlTarget } from "../src/shell/control_values.js";
import { type WorkspaceVariant } from "../src/shell/workspace_data.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

const { source, sourceVariant } = componentWorkspaceFixture();

test("control drafts preserve primitive edits and emit typed overrides", () => {
  const declared: Pick<ShellCatalogueComponent, "controls" | "propSchema"> = {
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
      type: "object",
      properties: {
        label: { type: "string" },
        count: { type: "number", minimum: -1, maximum: 10 },
        disabled: { type: "boolean" },
        tone: { type: "string", enum: ["strong", "quiet"] },
        accent: { type: "string", enum: ["warm", "cool"] },
        hint: { type: "string" },
      },
      required: ["label", "count", "disabled", "tone"],
      additionalProperties: false,
    },
  };
  const variant: WorkspaceVariant = {
    comparisonEligible: false,
    removed: false,
    value: {
      ...sourceVariant,
      ...declared,
      props: encodeProps({
        label: "Continue",
        count: -0,
        disabled: true,
        tone: "quiet",
        hint: "Optional",
      }),
    },
  };
  // The Props controls edit the shown saved variant with its own declarations.
  const target = controlTarget(source, variant, false);
  assert.ok(target);
  const draft = controlDraft(target);
  assert.deepEqual(draft, {
    label: { supplied: true, value: "Continue" },
    count: { supplied: true, value: "-0" },
    disabled: { supplied: true, value: true },
    tone: { supplied: true, value: "1" },
    accent: { supplied: false, value: "" },
    hint: { supplied: true, value: "Optional" },
  });

  const emptySelects = validateControlDraft(target, {
    ...draft,
    tone: { supplied: true, value: "" },
    accent: { supplied: true, value: "" },
  });
  assert.equal(emptySelects.overrides, undefined);
  assert.equal(emptySelects.errors["tone"], "Choose an available value.");
  assert.equal(emptySelects.errors["accent"], "Choose an available value.");

  const invalid = validateControlDraft(target, {
    ...draft,
    count: { supplied: true, value: "11" },
  });
  assert.equal(invalid.overrides, undefined);
  assert.equal(invalid.errors["count"], "Enter a number from -1 to 10.");

  const valid = validateControlDraft(target, {
    ...draft,
    label: { supplied: true, value: "Purchase" },
    hint: { supplied: false, value: "Optional" },
  });
  assert.deepEqual(valid.errors, {});
  // A render request carries a set value as JSON under the schema.
  assert.deepEqual(valid.overrides, {
    label: { kind: "set", value: "Purchase" },
    hint: { kind: "unset" },
  });
});
