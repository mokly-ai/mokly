import { defineComponent } from "@mokly/mokly";

import { GuestPicker } from "./guest-picker.js";

const dependency = "examples/basic/generated/example-components.css";
const implementation =
  "examples/basic/src/components/guest-picker/guest-picker.tsx";

export const guestPicker = defineComponent({
  id: "example-guest-picker",
  title: "Guest picker",
  description: "A guest count control for bookings.",
  navPath: ["Example", "Components"],
  dependencies: [dependency, implementation],
  ownedDependencies: [dependency, implementation],
  relatedDocs: ["examples/basic/README.md"],
  tags: ["forms"],
  propSchema: {
    kind: "object",
    properties: {
      label: { schema: { kind: "string", minLength: 1 } },
      initialCount: {
        schema: { kind: "number", integer: true, minimum: 0, maximum: 20 },
      },
      maximum: {
        schema: { kind: "number", integer: true, minimum: 1, maximum: 20 },
      },
    },
  },
  controls: {
    label: { kind: "text", label: "Label", maxLength: 80 },
    initialCount: {
      kind: "number",
      label: "Starting count",
      minimum: 0,
      maximum: 20,
      step: 1,
    },
    maximum: {
      kind: "number",
      label: "Capacity",
      minimum: 1,
      maximum: 20,
      step: 1,
    },
  },
  render: (props) => (
    <GuestPicker
      initialCount={props.initialCount}
      label={props.label}
      maximum={props.maximum}
    />
  ),
  variants: [
    {
      id: "example-guest-picker-dinner",
      title: "Dinner for two",
      props: { initialCount: 2, label: "Guests", maximum: 8 },
    },
    {
      id: "example-guest-picker-group",
      title: "Small group",
      props: { initialCount: 5, label: "Guests", maximum: 12 },
    },
  ],
});
