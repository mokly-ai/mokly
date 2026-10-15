import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import type { ComponentControl } from "../src/components/control_types.js";
import type { PropSchema } from "../src/components/prop_types.js";
import {
  controlDraft,
  numberInputBounds,
  validateControlDraft,
  WHOLE_PROPS_ERROR,
  type ControlTarget,
} from "../src/shell/control_values.js";

type NumberControl = Extract<ComponentControl, { kind: "number" }>;

const target: ControlTarget = {
  path: "components/action",
  title: "Action",
  kind: "component",
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: {
      label: { type: "string", maxLength: 5 },
      count: { type: "integer", minimum: 1, maximum: 9, multipleOf: 2 },
      ratio: { type: "number", minimum: 0, maximum: 1, multipleOf: 0.1 },
      on: { type: "boolean" },
      tone: { oneOf: [{ const: "calm", title: "Calm" }, { const: 2 }] },
    },
  } as unknown as PropSchema,
  props: encodeProps({ label: "Save", count: 4, tone: "calm" }),
  controls: {
    label: { kind: "text", maxLength: 5 },
    count: { kind: "number", minimum: 1, maximum: 9, step: 2 },
    ratio: { kind: "number", minimum: 0, maximum: 1, step: 0.1 },
    on: { kind: "boolean" },
    tone: {
      kind: "select",
      options: [
        { label: "Calm", value: "calm" },
        { label: "2", value: 2 },
      ],
    },
  },
  suppliedSlots: [],
  removed: false,
};

function draft(edits: Record<string, string | boolean | undefined>) {
  const base = { ...controlDraft(target) };
  for (const [key, value] of Object.entries(edits))
    base[key] =
      value === undefined
        ? { supplied: false, value: "" }
        : { supplied: true, value };
  return base;
}

test("number inputs offer only multiples of the step counted from zero", () => {
  const bounds = (control: Omit<NumberControl, "kind">) =>
    numberInputBounds({ kind: "number", ...control });
  assert.deepEqual(bounds({ minimum: 1, maximum: 9, step: 2 }), {
    min: 2,
    max: 8,
    step: 2,
  });
  assert.deepEqual(bounds({ minimum: 0.15, maximum: 0.95, step: 0.1 }), {
    min: 0.2,
    max: 0.9,
    step: 0.1,
  });
  assert.deepEqual(bounds({ minimum: -5, maximum: -1, step: 2 }), {
    min: -4,
    max: -2,
    step: 2,
  });
  assert.deepEqual(bounds({ minimum: -0.5, step: 0.5 }), {
    min: -0.5,
    step: 0.5,
  });
  assert.deepEqual(bounds({ step: 3 }), { step: 3 });
  assert.deepEqual(bounds({ minimum: 1.5, maximum: 2.5 }), {
    min: 1.5,
    max: 2.5,
    step: "any",
  });
});

test("the draft starts from the saved props", () => {
  assert.deepEqual(controlDraft(target), {
    count: { supplied: true, value: "4" },
    label: { supplied: true, value: "Save" },
    on: { supplied: false, value: false },
    ratio: { supplied: false, value: "" },
    tone: { supplied: true, value: "0" },
  });
});

test("a valid draft yields only the changed overrides", () => {
  assert.deepEqual(validateControlDraft(target, controlDraft(target)), {
    errors: {},
    overrides: {},
  });
  assert.deepEqual(
    validateControlDraft(
      target,
      draft({ count: "8", ratio: "0.3", on: true, tone: "1" }),
    ),
    {
      errors: {},
      overrides: {
        count: { kind: "set", value: 8 },
        on: { kind: "set", value: true },
        ratio: { kind: "set", value: 0.3 },
        tone: { kind: "set", value: 2 },
      },
    },
  );
  assert.deepEqual(validateControlDraft(target, draft({ count: undefined })), {
    errors: {},
    overrides: { count: { kind: "unset" } },
  });
});

test("an off-step or out-of-range number names the values it accepts", () => {
  for (const count of ["3", "1", "10", "0", "", "two", "Infinity"])
    assert.deepEqual(validateControlDraft(target, draft({ count })), {
      errors: { count: "Enter a number from 2 to 8 in steps of 2." },
    });
  assert.deepEqual(validateControlDraft(target, draft({ ratio: "0.35" })), {
    errors: { ratio: "Enter a number from 0 to 1 in steps of 0.1." },
  });
});

test("text and select fields keep their own limits", () => {
  assert.deepEqual(validateControlDraft(target, draft({ label: "Saving" })), {
    errors: { label: "Enter up to 5 characters." },
  });
  assert.deepEqual(validateControlDraft(target, draft({ tone: "7" })), {
    errors: { tone: "Choose an available value." },
  });
});

test("text length counts code points, like the schema", () => {
  assert.deepEqual(
    validateControlDraft(target, draft({ label: "😀😀😀😀😀" })),
    {
      errors: {},
      overrides: { label: { kind: "set", value: "😀😀😀😀😀" } },
    },
  );
  assert.deepEqual(
    validateControlDraft(target, draft({ label: "😀😀😀😀😀😀" })).errors,
    { label: "Enter up to 5 characters." },
  );
});

test("props that fail together name no field", () => {
  assert.deepEqual(validateControlDraft(target, draft({ label: undefined })), {
    errors: { [WHOLE_PROPS_ERROR]: "These values are not valid together." },
  });
});
