import { definePage, mockLink } from "@mokly/mokly";

const metadata = { description: "Definition links.", relatedDocs: [] };
export const destination = definePage({
  ...metadata,
  path: "destination",
  title: "Destination",
  render: () =>
    '<!doctype html><html><head></head><body id="résumé">Target</body></html>',
});
const href = mockLink(destination, "résumé");
export const source = definePage({
  ...metadata,
  path: "source",
  title: "Source",
  render: () =>
    `<!doctype html><html><head></head><body><a href="${href}">Target</a></body></html>`,
});
