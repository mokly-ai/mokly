import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isMultipleOf,
  profileAccepts,
  validateProfileValue,
} from "../src/components/profile_value.js";
import type { PropSchema } from "../src/components/prop_types.js";
import { validateProps } from "../src/components/props.js";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["label"],
  properties: {
    label: { type: "string", minLength: 1, maxLength: 3 },
    count: { type: "integer", minimum: 0, maximum: 10 },
    step: { type: "number", multipleOf: 0.1 },
    tone: { enum: ["neutral", "danger"] },
    size: { oneOf: [{ const: "sm", title: "Small" }, { const: "lg" }] },
    either: { anyOf: [{ type: "string" }, { type: "null" }] },
    tags: { type: "array", items: { type: "string" }, maxItems: 2 },
    nested: {
      type: "object",
      additionalProperties: false,
      properties: { on: { type: "boolean" } },
      required: ["on"],
    },
  },
} as unknown as PropSchema;

function valid(value: Record<string, unknown>): void {
  assert.doesNotThrow(
    () => validateProps(schema, value, "Fixture"),
    JSON.stringify(value),
  );
}

function invalid(value: Record<string, unknown>, reason: RegExp): void {
  assert.throws(
    () => validateProps(schema, value, "Fixture"),
    (error) => error instanceof Error && reason.test(error.message),
  );
}

test("values that satisfy every keyword are accepted unchanged", () => {
  valid({ label: "a" });
  valid({
    label: "abc",
    count: 10,
    step: 0.3,
    tone: "danger",
    size: "sm",
    either: null,
    tags: ["x", "y"],
    nested: { on: false },
  });
});

test("objects reject undeclared keys and missing required props", () => {
  invalid({}, /label: required prop is missing/);
  invalid({ label: "a", extra: 1 }, /extra: unknown prop/);
  invalid({ label: "a", nested: {} }, /on: required prop is missing/);
  invalid({ label: "a", nested: { on: true, off: false } }, /unknown prop/);
});

test("types, choices and unions are exact", () => {
  invalid({ label: 1 }, /expected string/);
  invalid({ label: "a", count: 1.5 }, /expected integer/);
  invalid({ label: "a", tone: "loud" }, /not an allowed option/);
  invalid({ label: "a", size: "md" }, /exactly one allowed choice/);
  invalid({ label: "a", either: 3 }, /does not match any allowed schema/);
  invalid({ label: "a", tags: ["x", 1] }, /expected string/);
});

test("string lengths count code points", () => {
  valid({ label: "😀😀😀" });
  invalid({ label: "😀😀😀😀" }, /longer than its maximum length/);
  invalid({ label: "" }, /shorter than its minimum length/);
});

test("number bounds and array sizes hold", () => {
  invalid({ label: "a", count: -1 }, /below its minimum/);
  invalid({ label: "a", count: 11 }, /above its maximum/);
  invalid({ label: "a", tags: ["x", "y", "z"] }, /too many items/);
});

test("multipleOf uses the decimal reading of both numbers", () => {
  valid({ label: "a", step: 0.3 });
  valid({ label: "a", step: -0.7 });
  valid({ label: "a", step: 0 });
  invalid({ label: "a", step: 0.35 }, /not a multiple of its step/);
  assert.equal(isMultipleOf(0.3, 0.1), true);
  assert.equal(isMultipleOf(1.1, 0.1), true);
  assert.equal(isMultipleOf(0.3, 0.2), false);
  assert.equal(isMultipleOf(10, 2.5), true);
  assert.equal(isMultipleOf(7, 2), false);
  assert.equal(isMultipleOf(1e21, 1e20), true);
  assert.equal(isMultipleOf(1e-7, 1e-8), true);
  assert.equal(isMultipleOf(0.0001, 0.001), false);
});

test("props are plain JSON data", () => {
  invalid(
    { label: "a", tags: [() => "x"] },
    /tags\[0\]: unsupported data value/,
  );
  invalid({ label: "a", count: Number.NaN }, /count: unsupported data value/);
  const cycle: Record<string, unknown> = { on: true };
  cycle.self = cycle;
  invalid({ label: "a", nested: cycle }, /cyclic data is unsupported/);
});

test("profileAccepts reports a match without throwing", () => {
  const tone = { enum: ["neutral", "danger"] } as unknown as PropSchema;
  assert.equal(profileAccepts(tone, "neutral"), true);
  assert.equal(profileAccepts(tone, "loud"), false);
  assert.throws(() => validateProfileValue(tone, "loud", "$.tone"), /\$\.tone/);
});
