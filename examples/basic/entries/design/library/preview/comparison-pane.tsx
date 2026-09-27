import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { optionalText, text } from "../schemas.js";

import { ComparisonPaneView } from "./comparison-pane.view.js";
import { deviceFrame } from "./device-frame.js";

const propSchema = {
  kind: "object",
  properties: {
    side: { schema: { kind: "enum", values: ["before", "after"] } },
    label: text,
    state: { schema: { kind: "enum", values: ["present", "missing"] } },
    message: optionalText,
  },
} as const;
const slots = ["children"] as const;
export type ComparisonPaneProps = ComponentProps<
  typeof propSchema,
  typeof slots
>;
export const comparisonPane = defineComponent({
  ...libraryMetadata(
    "preview",
    "comparison-pane",
    "Comparison pane",
    "A before or current preview, including an absent screen.",
  ),
  propSchema,
  slots,
  controls: {
    label: { kind: "text", label: "Label" },
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
      id: "design-ui-comparison-pane-before",
      title: "Before",
      props: {
        side: "before",
        label: "Before",
        state: "present",
        children: (
          <deviceFrame.Component
            device="phone"
            dark={false}
            small
            lightOnly={false}
            expandable
            address="example.test/welcome"
          >
            <MiniWelcome compact />
          </deviceFrame.Component>
        ),
      },
    },
    {
      id: "design-ui-comparison-pane-current",
      title: "Current",
      props: {
        side: "after",
        label: "Current",
        state: "present",
        children: (
          <deviceFrame.Component
            device="phone"
            dark={false}
            small
            lightOnly={false}
            expandable
            address="example.test/welcome"
          >
            <MiniWelcome compact />
          </deviceFrame.Component>
        ),
      },
    },
    {
      id: "design-ui-comparison-pane-missing-before",
      title: "Missing before",
      props: {
        side: "before",
        label: "Before",
        state: "missing",
        message: "This screen did not exist before.",
      },
    },
    {
      id: "design-ui-comparison-pane-missing-current",
      title: "Missing current",
      props: {
        side: "after",
        label: "Current",
        state: "missing",
        message: "This screen has been removed.",
      },
    },
  ],
});
