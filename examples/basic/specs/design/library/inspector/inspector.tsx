import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { destination, text } from "../schemas.js";

import { InspectorView } from "./inspector.view.js";

const propSchema = {
  kind: "object",
  properties: {
    tabs: {
      schema: {
        kind: "array",
        maxItems: 4,
        items: {
          kind: "object",
          properties: {
            id: {
              schema: {
                kind: "enum",
                values: ["info", "components", "props", "usage"],
              },
            },
            label: text,
            destination,
          },
        },
      },
    },
    initial: {
      schema: {
        kind: "enum",
        values: ["info", "components", "props", "usage", "closed"],
      },
    },
    sheetSize: { schema: { kind: "enum", values: ["compact", "expanded"] } },
  },
} as const;
const slots = ["info", "components", "props", "usage"] as const;
export type InspectorProps = ComponentProps<typeof propSchema, typeof slots>;
const sample = {
  tabs: [
    { id: "info", label: "Details" },
    { id: "props", label: "Props" },
    { id: "usage", label: "Usage" },
  ],
  initial: "info",
  sheetSize: "compact",
  info: <p>A shared action with an optional destination and hint.</p>,
  props: (
    <dl className="ce-props">
      <div>
        <dt>label</dt>
        <dd>
          <code>Continue</code>
        </dd>
      </div>
    </dl>
  ),
  usage: <p>Used by Welcome and Details.</p>,
} as const;
export const inspector = defineComponent({
  ...libraryMetadata(
    "inspector",
    "inspector",
    "Footer tabs panel",
    "The shared inspector: icon tabs, panel content and responsive sizing.",
  ),
  propSchema,
  slots,
  controls: {
    initial: {
      kind: "select",
      label: "Initial tab",
      options: (["info", "props", "usage", "closed"] as const).map((value) => ({
        label: value,
        value,
      })),
    },
    sheetSize: {
      kind: "select",
      label: "Mobile sheet",
      options: [
        { label: "Compact", value: "compact" },
        { label: "Expanded", value: "expanded" },
      ],
    },
  },
  render: InspectorView,
  variants: [
    { slug: "details", title: "Details", props: sample },
    {
      slug: "props",
      title: "Props",
      props: { ...sample, initial: "props" },
    },
    {
      slug: "closed",
      title: "Closed",
      props: { ...sample, initial: "closed" },
    },
  ],
});
