import assert from "node:assert/strict";
import { test } from "node:test";

import { encodeProps } from "../src/components/codec.js";
import type { ComponentControl } from "../src/components/control_types.js";
import type { PropSchema } from "../src/components/prop_types.js";
import {
  effectiveNumberControl,
  numberInputBounds,
} from "../src/shell/control_numbers.js";
import {
  controlDraft,
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

/** One field of `kind` over `property`, the only prop of its target. */
function single(
  property: Record<string, unknown>,
  control: ComponentControl,
): ControlTarget {
  return {
    ...target,
    propSchema: {
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: { value: property },
    } as unknown as PropSchema,
    props: encodeProps({}),
    controls: { value: control },
  };
}

function error(shown: ControlTarget, value: string): string | undefined {
  return validateControlDraft(shown, {
    value: { supplied: true, value },
  }).errors["value"];
}

test("a text error names its length in singular, plural, and equal forms", () => {
  const text = (property: Record<string, unknown>, maxLength?: number) =>
    single(
      { type: "string", ...property },
      { kind: "text", ...(maxLength === undefined ? {} : { maxLength }) },
    );
  assert.equal(error(text({ minLength: 2 }, 2), "abc"), "Enter 2 characters.");
  assert.equal(error(text({ minLength: 1 }, 1), "ab"), "Enter 1 character.");
  assert.equal(
    error(text({ minLength: 2 }, 5), "a"),
    "Enter 2 to 5 characters.",
  );
  assert.equal(error(text({}, 1), "ab"), "Enter up to 1 character.");
  assert.equal(
    error(text({ maxLength: 3 }), "abcd"),
    "Enter up to 3 characters.",
  );
  assert.equal(
    error(text({ minLength: 1 }), ""),
    "Enter at least 1 character.",
  );
  assert.equal(
    error(text({ minLength: 3 }), "a"),
    "Enter at least 3 characters.",
  );
  assert.equal(error(text({ enum: ["a"] }), "b"), "Enter an allowed value.");
});

test("a number inside the range of a step-1 field asks for a whole number", () => {
  const radius = single(
    { type: "number" },
    { kind: "number", minimum: 0, maximum: 32, step: 1 },
  );
  assert.equal(error(radius, "2.5"), "Enter a whole number from 0 to 32.");
  assert.equal(error(radius, "40"), "Enter a number from 0 to 32.");
  const above = single({ type: "integer", minimum: 0 }, { kind: "number" });
  assert.equal(error(above, "2.5"), "Enter a whole number of 0 or more.");
  assert.equal(error(above, "-1"), "Enter a number of 0 or more.");
  const below = single({ type: "integer", maximum: 9 }, { kind: "number" });
  assert.equal(error(below, "2.5"), "Enter a whole number of 9 or less.");
  const any = single({ type: "integer" }, { kind: "number" });
  assert.equal(error(any, "2.5"), "Enter a whole number.");
  const halves = single(
    { type: "number" },
    { kind: "number", minimum: 0, maximum: 2, step: 0.5 },
  );
  assert.equal(
    error(halves, "0.7"),
    "Enter a number from 0 to 2 in steps of 0.5.",
  );
});

test("a control without bounds or a step takes them from the schema", () => {
  const seats = single(
    { type: "integer", minimum: 1, maximum: 9, multipleOf: 2 },
    { kind: "number" },
  );
  const control = seats.controls["value"] as NumberControl;
  assert.deepEqual(effectiveNumberControl(seats, "value", control), {
    kind: "number",
    minimum: 1,
    maximum: 9,
    step: 2,
  });
  assert.equal(error(seats, "11"), "Enter a number from 2 to 8 in steps of 2.");
  const declared = single(
    { type: "number", minimum: 0, maximum: 100 },
    { kind: "number", minimum: 10, maximum: 20, step: 5 },
  );
  assert.deepEqual(
    effectiveNumberControl(
      declared,
      "value",
      declared.controls["value"] as NumberControl,
    ),
    { kind: "number", minimum: 10, maximum: 20, step: 5 },
  );
  const decimal = single({ type: "number" }, { kind: "number" });
  assert.deepEqual(
    effectiveNumberControl(
      decimal,
      "value",
      decimal.controls["value"] as NumberControl,
    ),
    { kind: "number" },
  );
});
