import { defineFolder, definePage } from "@mokly/mokly";

export const guides = defineFolder({
  path: "guides",
  title: "Guides & notes",
  order: ["getting-started"],
});

export default definePage({
  dependencies: ["notes.md"],
  relatedDocs: ["notes.md"],
  title: "Getting started",
  description: "File-derived page identity with an exported folder record.",
  render: () =>
    '<html><body><h1>Getting started</h1><a href="mock:account/invoice">Open invoice</a></body></html>',
});
