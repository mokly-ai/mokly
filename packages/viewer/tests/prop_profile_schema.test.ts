import assert from "node:assert/strict";
import { test } from "node:test";

import { validateControls } from "../src/components/controls.js";
import { validatePropSchema } from "../src/components/profile_schema.js";

const root = (properties: Record<string, unknown>, extra = {}) => ({
  type: "object",
  properties,
  additionalProperties: false,
  ...extra,
});

function accepted(schema: unknown): void {
  assert.doesNotThrow(() => validatePropSchema(schema), JSON.stringify(schema));
}

function rejected(schema: unknown, reason: RegExp): void {
  assert.throws(
    () => validatePropSchema(schema),
    (error) => error instanceof Error && reason.test(error.message),
    JSON.stringify(schema),
  );
}

test("schema and control lengths accept normalized unsafe integers", () => {
  const maximum = 1000000000000000100;
  const schema = root({
    text: { type: "string", maxLength: maximum },
    list: { type: "array", maxItems: maximum },
  });
  validatePropSchema(schema);
  assert.doesNotThrow(() =>
    validateControls(schema, {
      text: { kind: "text", maxLength: maximum },
    }),
  );
});

test("control length validation still rejects fractional and negative counts", () => {
  const schema = root({ text: { type: "string" } });
  validatePropSchema(schema);
  for (const maxLength of [-1, 0.5, Infinity]) {
    assert.throws(
      () =>
        validateControls(schema, {
          text: { kind: "text", maxLength },
        }),
      Number.isFinite(maxLength)
        ? /expected a nonnegative integer/
        : /unsupported data value/,
    );
  }
});

test("the profile accepts every keyword within its rule", () => {
  accepted({ type: "object", additionalProperties: false });
  accepted(
    root(
      {
        label: { type: "string", minLength: 1, maxLength: 40, title: "Label" },
        count: { type: "integer", minimum: 0, maximum: 10, multipleOf: 2 },
        ratio: { type: ["number", "null"], minimum: -1.5, maximum: 1.5 },
        tone: { enum: ["neutral", "danger", 3, null, true] },
        fixed: { const: "fixed", description: "Always fixed" },
        size: { oneOf: [{ const: "sm", title: "Small" }, { const: 1 }] },
        either: { anyOf: [{ type: "string" }, { type: "boolean" }] },
        tags: {
          type: "array",
          items: { type: "string" },
          minItems: 0,
          maxItems: 3,
        },
        any: { type: "array" },
        nested: root({ on: { type: "boolean" } }, { required: ["on"] }),
      },
      {
        required: ["label"],
        $schema: "https://json-schema.org/draft/2020-12/schema",
      },
    ),
  );
});

test("the root is an object schema", () => {
  rejected({ type: "string" }, /root schema type must be object/);
  rejected({ type: ["object", "null"], additionalProperties: false }, /root/);
  rejected({ enum: [{}] }, /root schema type must be object/);
  rejected([], /expected/);
});

test("every object schema closes its properties", () => {
  rejected({ type: "object" }, /additionalProperties: false/);
  rejected(
    { type: "object", additionalProperties: true },
    /additionalProperties: false/,
  );
  rejected(
    root({ nested: { type: "object", properties: {} } }),
    /properties\.nested\.additionalProperties/,
  );
  rejected(
    root({ nested: { type: "object", additionalProperties: {} } }),
    /additionalProperties: false/,
  );
});

test("keywords outside the profile fail", () => {
  for (const keyword of [
    "default",
    "$ref",
    "$defs",
    "if",
    "allOf",
    "not",
    "pattern",
    "format",
    "patternProperties",
    "dependentSchemas",
    "examples",
  ])
    rejected(
      root({ value: { type: "string", [keyword]: "x" } }),
      /keyword is outside the prop schema profile/,
    );
});

test("each schema declares a type or a closed choice", () => {
  rejected(
    root({ value: {} }),
    /must declare type, enum, const, oneOf or anyOf/,
  );
  rejected(root({ value: { title: "Only a title" } }), /must declare type/);
  rejected(root({ value: { type: "date" } }), /unique JSON types/);
  rejected(root({ value: { type: [] } }), /unique JSON types/);
  rejected(
    root({ value: { type: ["string", "string"] } }),
    /unique JSON types/,
  );
});

test("typed keywords need their matching type", () => {
  rejected(
    root({ value: { type: "number", maxLength: 3 } }),
    /keyword requires its matching type/,
  );
  rejected(
    root({ value: { type: "string", items: { type: "string" } } }),
    /keyword requires its matching type/,
  );
  rejected(
    root({ value: { type: "array", properties: {} } }),
    /keyword requires its matching type/,
  );
  rejected(
    root({ value: { type: "string", minimum: 1 } }),
    /numeric keyword requires a numeric type/,
  );
  rejected(
    root({ value: { enum: [1, 2], multipleOf: 1 } }),
    /numeric keyword requires a numeric type/,
  );
});

test("bounds are finite, ordered and never negative zero", () => {
  rejected(
    root({ value: { type: "number", minimum: 2, maximum: 1 } }),
    /lower bound exceeds upper bound/,
  );
  rejected(
    root({ value: { type: "string", minLength: 3, maxLength: 2 } }),
    /lower bound exceeds upper bound/,
  );
  rejected(
    root({ value: { type: "number", minimum: -0 } }),
    /other than negative zero/,
  );
  rejected(
    root({ value: { type: "string", maxLength: 1.5 } }),
    /nonnegative integer/,
  );
  rejected(
    root({ value: { type: "array", minItems: -1 } }),
    /nonnegative integer/,
  );
  rejected(
    root({ value: { type: "number", multipleOf: 0 } }),
    /multipleOf must be positive/,
  );
  rejected(
    root({ value: { type: "number", multipleOf: -2 } }),
    /multipleOf must be positive/,
  );
});

test("$schema is root-only and names draft 2020-12", () => {
  rejected(
    root({}, { $schema: "http://json-schema.org/draft-07/schema#" }),
    /\$schema is root-only and selects 2020-12/,
  );
  rejected(
    root({
      value: {
        type: "string",
        $schema: "https://json-schema.org/draft/2020-12/schema",
      },
    }),
    /\$schema is root-only/,
  );
});

test("required names declared properties once", () => {
  rejected(root({}, { required: ["missing"] }), /required names declared/);
  rejected(
    root({ a: { type: "string" } }, { required: ["a", "a"] }),
    /required names declared/,
  );
  rejected(
    root({ a: { type: "string" } }, { required: "a" }),
    /required names declared/,
  );
});

test("constants are JSON primitives and oneOf holds constants only", () => {
  rejected(
    root({ value: { const: { a: 1 } } }),
    /const must be a JSON primitive/,
  );
  rejected(
    root({ value: { enum: [[1]] } }),
    /enum values must be JSON primitives/,
  );
  rejected(root({ value: { oneOf: [] } }), /oneOf needs at least one constant/);
  rejected(
    root({ value: { oneOf: [{ type: "string" }] } }),
    /oneOf members allow only const and title/,
  );
  rejected(
    root({ value: { oneOf: [{ const: 1, description: "One" }] } }),
    /oneOf members allow only const and title/,
  );
  rejected(
    root({ value: { oneOf: [{ const: 1, title: 2 }] } }),
    /oneOf members allow only const and title/,
  );
  rejected(root({ value: { anyOf: [] } }), /anyOf needs at least one schema/);
  rejected(
    root({ value: { anyOf: [{ type: "string", default: "x" }] } }),
    /outside the prop schema profile/,
  );
});
