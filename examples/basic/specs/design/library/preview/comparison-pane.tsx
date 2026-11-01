import { defineComponent } from "@mokly/mokly";

import { MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { text, type LibraryProps } from "../schemas.js";

import { ComparisonPaneView } from "./comparison-pane.view.js";
import { deviceFrame } from "./device-frame.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["side", "state"],
  properties: {
    side: { enum: ["before", "after"] },
    state: { enum: ["present", "missing"] },
    message: text,
  },
} as const;
const slots = ["children"] as const;
export type ComparisonPaneProps = LibraryProps<typeof propSchema, typeof slots>;
const welcomeFrame = {
  children: (
    <deviceFrame.Component
      device="phone"
      dark={false}
      small
      lightOnly={false}
      expandable
      address="example.test/welcome"
    >
      <MiniWelcome compact inert />
    </deviceFrame.Component>
  ),
};
export const comparisonPane = defineComponent({
  ...libraryMetadata(
    "preview",
    "comparison-pane",
    "Comparison pane",
    "A before or current preview, including an absent screen.",
  ),
  propSchema,
  props: { side: "before", state: "present" },
  slots,
  controls: {
    state: {
      kind: "select",
      label: "State",
      options: [
        { label: "Present", value: "present" },
        { label: "Missing", value: "missing" },
      ],
    },
    message: { kind: "text", label: "Missing message" },
  },
  render: ComparisonPaneView,
  variants: [
    {
      slug: "before",
      title: "Before",
      props: { side: "before", state: "present" },
      slots: welcomeFrame,
    },
    {
      slug: "current",
      title: "Current",
      props: { side: "after", state: "present" },
      slots: welcomeFrame,
    },
    {
      slug: "missing-before",
      title: "Missing before",
      props: {
        side: "before",
        state: "missing",
        message: "This screen did not exist before.",
      },
    },
    {
      slug: "missing-current",
      title: "Missing current",
      props: {
        side: "after",
        state: "missing",
        message: "This screen has been removed.",
      },
    },
  ],
});
