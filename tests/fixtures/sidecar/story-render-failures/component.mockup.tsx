import { defineComponent } from "@mokly/mokly";

export const badge = defineComponent({
  path: "badge",
  title: "Badge",
  description: "A registered component for story renders.",
  relatedDocs: [],
  propSchema: {
    type: "object",
    properties: { label: { type: "string" } },
    required: ["label"],
    additionalProperties: false,
  },
  props: { label: "Ready" },
  render({ label }) {
    if (label === "Fail") throw new Error("Badge render failed");
    return <span>{label}</span>;
  },
});
