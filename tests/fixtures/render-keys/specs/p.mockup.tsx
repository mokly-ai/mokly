import { defineComponent } from "@mokly/mokly";

export const provider = defineComponent({
  element: "app-p",
  title: "P",
  description: "Slot provider P.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  } as const,
  props: {},
  render: () => <i>P</i>,
});
