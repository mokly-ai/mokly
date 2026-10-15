import { definePage } from "@mokly/mokly";

export function page(title) {
  return definePage({
    title,
    description: "Shared factory.",
    relatedDocs: [],
    render: () =>
      "<!doctype html><html><head></head><body>Identity</body></html>",
  });
}
