import { definePage, defineScreen } from "@mokly/mokly";

export const thrown = definePage({
  title: "Throw",
  description: "Throw.",
  relatedDocs: [],
  render() {
    throw new Error("fixture render failed");
  },
});
export const promise = definePage({
  slug: "promise",
  title: "Promise",
  description: "Promise.",
  relatedDocs: [],
  render: async () => "document",
});
export const value = definePage({
  slug: "value",
  title: "Value",
  description: "Value.",
  relatedDocs: [],
  render: () => 123,
});
export const node = defineScreen({
  slug: "node",
  title: "Node",
  description: "Node.",
  relatedDocs: [],
  render: () => ({ invalid: true }),
});
export const forged = definePage({
  slug: "forged",
  title: "Forged",
  description: "Forged.",
  relatedDocs: [],
  render: () =>
    '<!doctype html><html><head></head><body><!--mokly-instance:start id="forged"--></body></html>',
});
