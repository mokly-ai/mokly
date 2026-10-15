import assert from "node:assert/strict";
import test from "node:test";

import { defineComponent, definePage, defineScreen } from "@mokly/mokly";
import type { ScreenDefinition } from "@mokly/mokly";

const metadata = {
  title: "Types",
  description: "Type inference.",
  relatedDocs: [],
};
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "tone", "items"],
  properties: {
    label: { type: "string" },
    tone: { enum: ["primary", "secondary"] },
    items: { type: "array", items: { type: "integer" } },
    optional: { type: "boolean" },
  },
} as const;

const component = defineComponent({
  ...metadata,
  propSchema: schema,
  slots: ["children"],
  props: { label: "A", tone: "primary", items: [1] },
  render(props, context) {
    const label: string = props.label;
    const tone: "primary" | "secondary" = props.tone;
    const values: readonly number[] = props.items;
    const optional: boolean | undefined = props.optional;
    // @ts-expect-error Schema arrays are readonly in the render adapter.
    props.items.push(2);
    // @ts-expect-error The schema determines data types.
    const invalid: number = props.label;
    return [
      label,
      tone,
      values.join(","),
      optional,
      invalid,
      context.viewport,
      props.children,
    ];
  },
  variants: [
    { slug: "secondary", title: "Secondary", props: { tone: "secondary" } },
  ],
});

const screen = defineScreen({
  ...metadata,
  props: { label: "A", count: 2 },
  render(props) {
    const count: number = props.count;
    // @ts-expect-error An inferred string prop is not a number.
    const invalid: number = props.label;
    return [count, invalid];
  },
  variants: [{ slug: "b", title: "B", props: { label: "B" } }],
});
const declared = defineScreen({
  ...metadata,
  propSchema: schema,
  props: { label: "A", tone: "primary", items: [] },
  render(props) {
    const tone: "primary" | "secondary" = props.tone;
    return tone;
  },
});

function _invalidInputs() {
  defineComponent({
    ...metadata,
    propSchema: schema,
    // @ts-expect-error The required data properties must be present.
    props: { label: "A" },
    render: () => null,
  });
  defineComponent({
    ...metadata,
    propSchema: schema,
    render: () => null,
    variants: [
      {
        slug: "bad",
        title: "Bad",
        props: {
          // @ts-expect-error Variant props share the schema's literal union.
          tone: "danger",
        },
      },
    ],
  });
  defineScreen({
    ...metadata,
    props: { count: 1 },
    render: () => null,
    variants: [
      {
        slug: "bad",
        title: "Bad",
        props: {},
        // @ts-expect-error Fresh variant literals reject unknown keys.
        path: "elsewhere",
      },
    ],
  });
  // @ts-expect-error Screen variants are carried by one definition.
  const array: readonly ScreenDefinition[] = screen;
  // @ts-expect-error Page callbacks are synchronous strings.
  definePage({ ...metadata, render: async () => "document" });
  return array;
}

test("authoring returns one definition with its typed wrapper", () => {
  assert.equal(component.kind, "component");
  assert.equal(typeof component.Component, "function");
  assert.equal(screen.kind, "screen");
  assert.equal(declared.kind, "screen");
  assert.ok(!Array.isArray(screen));
});
