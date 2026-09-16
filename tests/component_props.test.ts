import assert from "node:assert/strict";
import { test } from "node:test";

import {
  encodeProps,
  decodeProps,
  encodeValue,
  decodeValue,
} from "../packages/viewer/dist/components/codec.js";
import { canonicalJson } from "../packages/viewer/dist/components/data.js";
import type { PropValue } from "../packages/viewer/dist/components/prop_types.js";
import { validateProps } from "../packages/viewer/dist/components/props.js";
import { validatePropSchema } from "../packages/viewer/dist/components/schema.js";
import { reviewMaterialKey } from "../packages/viewer/dist/data/material_key.js";

const schema = {
  kind: "object",
  properties: {
    label: { schema: { kind: "string", minLength: 1 } },
    count: { schema: { kind: "number" } },
    hint: { optional: true, schema: { kind: "string" } },
    nested: {
      schema: {
        kind: "array",
        items: {
          kind: "union",
          anyOf: [
            { kind: "null" },
            {
              kind: "object",
              properties: { active: { schema: { kind: "boolean" } } },
            },
          ],
        },
      },
    },
  },
} as const;

test("component props preserve values and negative zero through their canonical codec", () => {
  validatePropSchema(schema);
  const input = {
    label: "Confirm",
    count: -0,
    hint: undefined,
    nested: [null, { active: false }],
  };
  const props = validateProps(schema, input, "Action / Default / mobile");
  assert.equal(Object.hasOwn(props, "hint"), false);
  const roundTrip = decodeProps(encodeProps(props));
  assert.deepEqual(roundTrip, props);
  assert.ok(Object.is(roundTrip.count, -0));
  assert.equal(reviewMaterialKey(roundTrip), reviewMaterialKey(props));
  input.nested[1] = { active: true };
  assert.deepEqual(props.nested, [null, { active: false }]);
});

test("closed component schemas validate uncontrolled, optional and nested inputs", () => {
  const valid = { label: "Confirm", count: 2, nested: [] };
  for (const props of [
    { ...valid, extra: true },
    { ...valid, label: undefined },
    { ...valid, count: Infinity },
    { ...valid, nested: [undefined] },
    { ...valid, nested: Array<unknown>(1) },
    { ...valid, nested: [{ active: 1 }] },
  ]) {
    assert.throws(() => validateProps(schema, props, "Action"), /Action.*\$/);
  }
  assert.throws(
    () => validateProps(schema, { ...valid, hint: null }, "Action"),
    /hint/,
  );
  assert.throws(
    () => validateProps(schema, { ...valid, label: "" }, "Action"),
    /label/,
  );
});

test("component schema rejects malformed, unsafe and ambiguous declarations", () => {
  for (const invalid of [
    { kind: "object", properties: {}, additionalProperties: true },
    { kind: "number", minimum: -0 },
    { kind: "number", minimum: 2, maximum: 1 },
    { kind: "string", minLength: -1 },
    { kind: "array", items: { kind: "boolean" }, maxItems: 1.5 },
    { kind: "enum", values: [] },
    { kind: "enum", values: ["one", "one"] },
    { kind: "enum", values: [-0] },
    { kind: "union", anyOf: [{ kind: "null" }] },
    {
      kind: "object",
      properties: { constructor: { schema: { kind: "null" } } },
    },
  ])
    assert.throws(() => validatePropSchema(invalid));
  validatePropSchema({ kind: "enum", values: ["1", 1, false, null] });
});

test("props reject accessors, classes, cycles, symbols and bounded oversized values without executing getters", () => {
  const objectSchema = {
    kind: "object",
    properties: { data: { schema: { kind: "string" } } },
  } as const;
  const getter = Object.defineProperty({}, "data", {
    enumerable: true,
    get() {
      assert.fail("must not execute getter");
    },
  });
  const cyclic: Record<string, unknown> = {};
  cyclic.data = cyclic;
  for (const value of [
    getter,
    new Date(),
    cyclic,
    { data: Symbol("x") },
    { data: () => {} },
    { data: 1n },
    { data: "x", [Symbol("x")]: true },
  ]) {
    assert.throws(() => validateProps(objectSchema, value));
  }
  const arraySchema = {
    kind: "object",
    properties: {
      data: { schema: { kind: "array", items: { kind: "null" } } },
    },
  } as const;
  assert.throws(
    () => validateProps(arraySchema, { data: Array(10_001).fill(null) }),
    /limit/,
  );
  let deep: unknown = { kind: "string" };
  for (let i = 0; i < 65; i++) deep = { kind: "array", items: deep };
  assert.throws(() => validatePropSchema(deep), /limit/);
});

test("codec rejects noncanonical values and orders integer-looking keys lexically", () => {
  for (const value of [
    ["number", "01"],
    ["number", "1.0"],
    ["number", "NaN"],
    ["number", "Infinity"],
    ["null", null],
    [
      "object",
      [
        ["a", ["null"]],
        ["a", ["null"]],
      ],
    ],
    [
      "object",
      [
        ["2", ["null"]],
        ["10", ["null"]],
      ],
    ],
  ])
    assert.throws(() => decodeValue(value));
  const value = { "2": true, "10": false };
  assert.deepEqual(encodeValue(value), [
    "object",
    [
      ["10", ["boolean", false]],
      ["2", ["boolean", true]],
    ],
  ]);
  assert.equal(canonicalJson(value), '{"10":false,"2":true}');
  assert.deepEqual(decodeValue(encodeValue(value)), value);
});

test("codec budget follows logical data nesting rather than its tagged containers", () => {
  let value: PropValue = "leaf";
  for (let i = 0; i < 64; i++) value = [value];
  assert.deepEqual(decodeValue(encodeValue(value)), value);
  assert.throws(() => decodeValue(["array", [encodeValue(value)]]), /limit/);
});
