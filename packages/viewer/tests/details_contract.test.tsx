import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { EntryDetailsBody } from "../src/shell/details.js";

import {
  publishedCatalogue,
  publishedComponent,
  publishedPage,
  publishedScreen,
  publishedUseCase,
} from "./published_entries_fixture.js";

/** One routed entry of each kind, each with a related document. */
const records = {
  pages: [publishedPage("page", "Example")],
  screens: [
    { ...publishedScreen("screen", "Example"), useCasePaths: ["flow"] },
  ],
  useCases: [publishedUseCase("flow", "Example", ["screen"])],
  components: [publishedComponent("component", "Example")],
};
for (const record of Object.values(records).flat())
  record.details.relatedDocs = ["notes.md"];
const PATHS = ["page", "screen", "flow", "component"] as const;
const catalogue = publishedCatalogue({
  ...records,
  tree: PATHS.map((path) => ({ kind: "entry", path })),
});

test("details omit authoring dependencies for every routed entry kind", () => {
  for (const path of PATHS) {
    const entry = catalogue.byPath.get(path);
    assert.ok(entry, path);
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
    assert.match(markup, /<span class="mbk-meta-k mbk-reset">Source<\/span>/);
    assert.match(
      markup,
      /<span class="mbk-meta-k mbk-reset">Related docs<\/span>/,
    );
    assert.doesNotMatch(
      markup,
      /Dependencies|legacy\/source-only\.ts|legacy\/owned\.css/,
    );
  }
});
