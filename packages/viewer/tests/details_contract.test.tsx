import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ManifestV8 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { EntryDetailsBody } from "../src/shell/details.js";

const common = {
  description: "An entry",
  navPath: [],
  relatedDocs: ["notes.md"],
  sourcePath: "entries/fixture.mockup.tsx",
  title: "Example",
};
const manifest: ManifestV8 = {
  folders: [],
  entries: [
    { ...common, path: "page", kind: "page" },
    {
      ...common,

      path: "screen",
      kind: "screen",
      colorSchemes: ["light"],
      useCasePaths: [],
    },
    {
      ...common,
      path: "flow",
      kind: "use-case",

      steps: [{ screenPath: "screen" }],
    },
    {
      ...common,
      controls: {},
      colorSchemes: ["light"],
      path: "component",
      kind: "component",
      propSchema: { kind: "object", properties: {} },

      slots: [],
    },
  ],
  generatedBy: "mokly",
  schemaVersion: 8,
  sourceFiles: [common.sourcePath],
};

test("details omit authoring dependencies for every routed entry kind", () => {
  const catalogue = createCatalogue(manifest);
  for (const entry of manifest.entries) {
    const legacyEntry = {
      ...entry,
      dependencies: ["legacy/source-only.ts"],
      ...(entry.kind === "component"
        ? { ownedDependencies: ["legacy/owned.css"] }
        : {}),
    } as unknown as typeof entry;
    const markup = renderToStaticMarkup(
      <EntryDetailsBody catalogue={catalogue} entry={legacyEntry} />,
    );
    assert.match(markup, /<span class="mbk-meta-k">Source<\/span>/);
    assert.match(markup, /<span class="mbk-meta-k">Related docs<\/span>/);
    assert.doesNotMatch(
      markup,
      /Dependencies|legacy\/source-only\.ts|legacy\/owned\.css/,
    );
  }
});
