import { defineComponent } from "@mokly/mokly";

export default defineComponent({
  title: "Bad props",
  description: "Plain data failure.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" } },
  },
  props: { label: () => "bad" },
  render: () => null,
});
