import { defineComponent } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { MiniDetails, MiniWelcome } from "../../parts/mini_screens.js";
import { libraryMetadata } from "../metadata.js";
import { destination, text, type LibraryProps } from "../schemas.js";

import { deviceFrame } from "./device-frame.js";
import { FlowStepView } from "./flow-step.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["number", "title", "description", "screenPath"],
  properties: {
    number: { type: "integer", minimum: 1 },
    title: text,
    description: text,
    screenPath: destination,
  },
} as const;
const slots = ["children"] as const;
export type FlowStepProps = LibraryProps<typeof propSchema, typeof slots>;
const first = {
  number: 1,
  title: "Welcome",
  description: "The tour starts on the landing screen.",
  screenPath: DESTINATIONS.welcome,
} as const;
export const flowStep = defineComponent({
  ...libraryMetadata(
    "preview",
    "flow-step",
    "Flow step",
    "A numbered step with a reference to its owning screen.",
  ),
  propSchema,
  props: first,
  slots,
  controls: {
    number: { kind: "number", label: "Step", minimum: 1, step: 1 },
    title: { kind: "text", label: "Title" },
    description: { kind: "text", label: "Description" },
  },
  render: FlowStepView,
  variants: [
    {
      slug: "first",
      title: "First step",
      props: first,
      slots: {
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
      slug: "second",
      title: "Second step",
      props: {
        number: 2,
        title: "Details",
        description: "The tour ends on the details screen.",
        screenPath: DESTINATIONS.details,
      },
      slots: {
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
