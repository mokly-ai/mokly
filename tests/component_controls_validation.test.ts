import assert from "node:assert/strict";
import { test } from "node:test";

import { defineComponent } from "../dist/components/definition.js";
import {
  validateControls,
  validateControlledValues,
} from "../packages/viewer/dist/components/controls.js";

const schema = {
  kind: "object",
  properties: {
    label: { schema: { kind: "string", maxLength: 10 } },
    count: {
      schema: { kind: "number", minimum: -1, maximum: 10 },
      optional: true,
    },
    active: { schema: { kind: "boolean" } },
    preset: { schema: { kind: "enum", values: ["primary", "quiet", null] } },
  },
} as const;

test("controls accept only declared compatible data props and lossless preset values", () => {
  const controls = {
    label: { kind: "text", maxLength: 8 },
    count: { kind: "number", minimum: 0, maximum: 5, step: 0.1 },
    active: { kind: "boolean" },
    preset: {
      kind: "select",
      options: [
        { label: "Quiet", value: "quiet" },
        { label: "None", value: null },
      ],
    },
  } as const;
  validateControls(schema, controls);
  validateControlledValues(
    controls,
    { label: "Hi", active: true, preset: null },
    "Action",
  );
  assert.throws(
    () => validateControlledValues(controls, { count: -1 }, "Action"),
    /count/,
  );
  assert.throws(
    () => validateControlledValues(controls, { preset: "primary" }, "Action"),
    /preset/,
  );
  for (const invalid of [
    { children: { kind: "text" } },
    { active: { kind: "text" } },
    { count: { kind: "number", step: 0 } },
    { count: { kind: "number", minimum: -0 } },
    { label: { kind: "text", optional: true } },
    { preset: { kind: "select", options: [] } },
    { preset: { kind: "select", options: [{ label: "Empty", value: -0 }] } },
    {
      preset: {
        kind: "select",
        options: [
          { label: "Primary", value: "primary" },
          { label: "Primary again", value: "primary" },
        ],
      },
    },
  ])
    assert.throws(() => validateControls(schema, invalid));
});

test("saved props and schemas are isolated from the author's later mutations", () => {
  const input = {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  } as const;
  const props = { label: "Before" };
  const component = defineComponent({
    id: "action",
    title: "Action",
    description: "Shared action",
    route: "action.html",
    relatedDocs: [],
    dependencies: [],
    propSchema: input,
    variants: [{ id: "default", title: "Default", props }],
    render: (value) => value.label,
  });
  props.label = "After";
  Object.assign(input.properties.label.schema, { maxLength: 1 });
  assert.equal(component.entry.variants[0]!.props.label, "Before");
  assert.deepEqual(component.entry.propSchema.properties.label!.schema, {
    kind: "string",
  });
});
