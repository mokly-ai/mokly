import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ManifestV6 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { EntryDetailsBody } from "../src/shell/details.js";

const common = {
  description: "An entry",
  navPath: [],
  relatedDocs: ["notes.md"],
  sourcePath: "entries/fixture.mockup.tsx",
  title: "Example",
};
const manifest: ManifestV6 = {
  entries: [
    { ...common, id: "page", kind: "page", route: "page.html" },
    {
      ...common,
      fragments: {
        mobile: "screen.mobile.html",
        desktop: "screen.desktop.html",
      },
      id: "screen",
      kind: "screen",
      route: "screen.html",
      useCaseIds: [],
      viewports: ["mobile", "desktop"],
    },
    {
      ...common,
      id: "flow",
      kind: "use-case",
      route: "flow.html",
      steps: [{ screenId: "screen" }],
    },
    {
      ...common,
      controls: {},
      id: "component",
      kind: "component",
      propSchema: { kind: "object", properties: {} },
      route: "component.html",
      slots: [],
      variants: [],
      viewports: ["mobile", "desktop"],
    },
  ],
  generatedBy: "mokly",
  schemaVersion: 6,
  sourceFiles: [common.sourcePath],
};

test("details omit authoring dependencies for every routed entry kind", () => {
  const catalogue = createCatalogue(manifest);
  for (const entry of manifest.entries) {
    if (entry.kind === "collection") continue;
    const markup = renderToStaticMarkup(
      <EntryDetailsBody catalogue={catalogue} entry={entry} />,
    );
    assert.match(markup, /<span class="mbk-meta-k">Source<\/span>/);
    assert.match(markup, /<span class="mbk-meta-k">Related docs<\/span>/);
    assert.doesNotMatch(
      markup,
      /Dependencies|legacy\/source-only\.ts|legacy\/owned\.css/,
    );
  }
});
