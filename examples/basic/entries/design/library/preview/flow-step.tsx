import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { MiniDetails, MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { destination, text } from "../schemas.js";

import { deviceFrame } from "./device-frame.js";
import { FlowStepView } from "./flow-step.view.js";

const propSchema = {
  kind: "object",
  properties: {
    number: { schema: { kind: "number", minimum: 1, integer: true } },
    title: text,
    description: text,
    screenId: { ...destination, optional: false },
  },
} as const;
const slots = ["children"] as const;
export type FlowStepProps = ComponentProps<typeof propSchema, typeof slots>;
export const flowStep = defineComponent({
  ...libraryMetadata(
    "preview",
    "flow-step",
    "Flow step",
    "A numbered step with a reference to its owning screen.",
  ),
  propSchema,
  slots,
  controls: {
    number: { kind: "number", label: "Step", minimum: 1, step: 1 },
    title: { kind: "text", label: "Title" },
    description: { kind: "text", label: "Description" },
  },
  render: FlowStepView,
  variants: [
    {
      id: "design-ui-flow-step-first",
      title: "First step",
      props: {
        number: 1,
        title: "Welcome",
        description: "The tour starts on the landing screen.",
        screenId: DESTINATIONS.welcome,
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
      id: "design-ui-flow-step-second",
      title: "Second step",
      props: {
        number: 2,
        title: "Details",
        description: "The tour ends on the details screen.",
        screenId: DESTINATIONS.details,
        children: (
          <deviceFrame.Component
            device="phone"
            dark={false}
            small
            lightOnly={false}
            expandable
            address="example.test/details"
          >
            <MiniDetails compact />
          </deviceFrame.Component>
        ),
      },
    },
  ],
});
