import { definePage } from "@mokly/mokly";

export default definePage({
  title: "Page",
  description: "A complete callback document.",
  relatedDocs: [],
  render: () =>
    '<!doctype html><html><head><title>Page</title></head><body><h1>Page body</h1><a href="mock:mixed">Mixed</a></body></html>',
});
