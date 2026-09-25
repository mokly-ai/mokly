import type { ComponentProps, ReactNode } from "react";

import { defineComponent } from "../dist/components/definition.js";

const metadata = {
  id: "test",
  title: "Test",
  description: "Typed component",
  route: "test.html",
  relatedDocs: [],
};
const definition = defineComponent({
  ...metadata,
  propSchema: {
    kind: "object",
    properties: {
      label: { schema: { kind: "string" } },
      intent: { schema: { kind: "enum", values: ["primary", "quiet"] } },
      optional: { optional: true, schema: { kind: "number" } },
      nested: {
        schema: {
          kind: "object",
          properties: { enabled: { schema: { kind: "boolean" } } },
        },
      },
    },
  },
  slots: ["children"],
  render: (props) => {
    const child: ReactNode = props.children;
    return (
      <div>
        {props.label}
        {child}
        {props.nested.enabled ? props.intent : props.optional}
      </div>
    );
  },
  variants: [
    {
      id: "default",
      title: "Default",
      props: { label: "Hello", intent: "primary", nested: { enabled: true } },
    },
  ],
  controls: {
    label: { kind: "text" },
    intent: {
      kind: "select",
      options: [
        { label: "Quiet", value: "quiet" },
        { label: "Primary", value: "primary" },
      ],
    },
  },
});

export const valid = (
  <definition.Component
    label="Confirm"
    intent="quiet"
    nested={{ enabled: false }}
    moklyInstance="footer"
  >
    <strong>Slot</strong>
  </definition.Component>
);
type Props = ComponentProps<typeof definition.Component>;
// @ts-expect-error Required data cannot be omitted.
export const missing: Props = { intent: "primary", nested: { enabled: true } };
export const badEnum: Props = {
  label: "Hello",
  nested: { enabled: true },
  // @ts-expect-error Literal enum values stay narrow.
  intent: "unknown",
};
export const badOptional: Props = {
  label: "Hello",
  intent: "primary",
  nested: { enabled: true },
  // @ts-expect-error Optional data keeps its declared type.
  optional: "1",
};
export const badNested: Props = {
  label: "Hello",
  intent: "primary",
  // @ts-expect-error Nested fields are derived from the schema.
  nested: { enabled: "yes" },
};
export const badSlot: Props = {
  label: "Hello",
  intent: "primary",
  nested: { enabled: true },
  // @ts-expect-error Slots are declared separately, with no catch-all JSX props.
  icon: <i />,
};

export const invalidVariant = defineComponent({
  ...metadata,
  propSchema: {
    kind: "object",
    properties: { enabled: { schema: { kind: "boolean" } } },
  },
  render: (props) => String(props.enabled),
  // @ts-expect-error Saved variants use the schema, not inference from example values.
  variants: [{ id: "default", title: "Default", props: { enabled: "yes" } }],
});
export const invalidControl = defineComponent({
  ...metadata,
  propSchema: {
    kind: "object",
    properties: { enabled: { schema: { kind: "boolean" } } },
  },
  render: (props) => String(props.enabled),
  variants: [{ id: "default", title: "Default", props: { enabled: true } }],
  // @ts-expect-error Controls must match the schema's primitive type.
  controls: { enabled: { kind: "number" } },
});
