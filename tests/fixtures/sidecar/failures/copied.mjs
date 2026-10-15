import { definePage } from "@mokly/mokly";

const page = definePage({
  title: "Copied",
  description: "Copied identity.",
  relatedDocs: [],
  render: () => "doc",
});
export const copied = { ...page };
