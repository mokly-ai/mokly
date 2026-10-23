import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { destination, text, type LibraryProps } from "../schemas.js";

import { InspectorView } from "./inspector.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tabs", "initial", "sheetSize"],
  properties: {
    tabs: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { enum: ["info", "components", "props", "usage"] },
          label: text,
          destination,
        },
      },
    },
    initial: { enum: ["info", "components", "props", "usage", "closed"] },
    sheetSize: { enum: ["compact", "expanded"] },
  },
} as const;
const slots = ["info", "components", "props", "usage"] as const;
export type InspectorProps = LibraryProps<typeof propSchema, typeof slots>;
const sample = {
  tabs: [
    { id: "info", label: "Details" },
    { id: "props", label: "Props" },
    { id: "usage", label: "Usage" },
  ],
  initial: "info",
  sheetSize: "compact",
} as const;
const sampleSlots = {
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
};
export const inspector = defineComponent({
  ...libraryMetadata(
    "inspector",
    "inspector",
    "Footer tabs panel",
    "The shared inspector: icon tabs, panel content and responsive sizing.",
  ),
  propSchema,
  props: sample,
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
    { slug: "details", title: "Details", props: sample, slots: sampleSlots },
    {
      slug: "props",
      title: "Props",
      props: { ...sample, initial: "props" },
      slots: sampleSlots,
    },
    {
      slug: "closed",
      title: "Closed",
      props: { ...sample, initial: "closed" },
      slots: sampleSlots,
    },
  ],
});
