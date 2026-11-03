import assert from "node:assert/strict";
import { test } from "node:test";

import { ComponentValidationError } from "../src/components/data.js";
import {
  validatePropSchema,
  validateProps,
  validatePropValues,
} from "../src/data.js";
import type { PropSchema } from "../src/generated/catalogue/PropSchema.js";

import cases from "./fixtures/author-checks/props.json" with { type: "json" };

function root(property: PropSchema): PropSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: { value: property },
    required: ["value"],
  };
}

test("shared props cases keep exact values and rejection rules", () => {
  for (const fixture of cases.values) {
    const schema = fixture.schema;
    validatePropSchema(schema);
    for (const validate of [validateProps, validatePropValues]) {
      if (fixture.valid)
        assert.equal(
          validate(schema, fixture.value),
          fixture.value,
          fixture.name,
        );
      else
        assert.throws(
          () => validate(schema, fixture.value),
          ComponentValidationError,
          fixture.name,
        );
    }
  }
});

test("schemas allow reserved property names while values reject them", () => {
  for (const key of cases.reservedProperties) {
    const properties = Object.fromEntries([[key, { type: "null" }]]);
    const schema = { type: "object", additionalProperties: false, properties };
    assert.doesNotThrow(() => validatePropSchema(schema), key);
    validatePropSchema(schema);
    assert.deepEqual(validateProps(schema, {}), {}, key);
    assert.throws(
      () => validatePropValues(schema, Object.fromEntries([[key, null]])),
      ComponentValidationError,
      key,
    );
    const nested = root(schema);
    validatePropSchema(nested);
    assert.deepEqual(validatePropValues(nested, { value: {} }), { value: {} });
    assert.throws(
      () =>
        validatePropValues(nested, {
          value: Object.fromEntries([[key, null]]),
        }),
      ComponentValidationError,
      key,
    );
  }
});

test("shared data limits count values without charging anyOf probes", () => {
  for (const validate of [validateProps, validatePropValues])
    for (const fixture of cases.limits) {
      const property: PropSchema = fixture.probe
        ? {
            anyOf: [
              { type: "string" },
              { type: "array", items: { type: "null" } },
            ],
          }
        : { type: "array" };
      const schema = root(property);
      let value: unknown = null;
      if (fixture.kind === "wide") value = Array<null>(fixture.size).fill(null);
      else for (let i = 0; i < fixture.size; i++) value = [value];
      const props = { value };
      if (fixture.valid) {
        assert.doesNotThrow(() => validate(schema, props), fixture.name);
        assert.equal(validate(schema, props), props, fixture.name);
      } else
        assert.throws(
          () => validate(schema, props),
          /validation limit exceeded/,
          fixture.name,
        );
    }
});

test("value-only validation preserves negative zero and rejects executable data", () => {
  const schema = root({ type: "number" });
  const props = { value: -0 };
  assert.equal(validatePropValues(schema, props), props);
  assert.equal(Object.is(validatePropValues(schema, props).value, -0), true);
  let accessed = false;
  const getter = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      accessed = true;
      return 1;
    },
  });
  assert.throws(
    () => validatePropValues(schema, getter),
    ComponentValidationError,
  );
  assert.equal(accessed, false);
});
