import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { EntryDetailsBody } from "../src/shell/details.js";

import { catalogueFixture, indexFixture } from "./catalogue_v9_fixture.js";

/** The Details body of one current or removed entry of the edited fixture. */
function details(path: string, edit: (index: CatalogueReadModel) => void) {
  const catalogue = catalogueFixture(indexFixture(edit));
  const entry =
    catalogue.manifest.entries.find((candidate) => candidate.path === path) ??
    catalogue.removedEntries.find((record) => record.entry.path === path)
      ?.entry;
  assert.ok(entry, path);
  return renderToStaticMarkup(
    <EntryDetailsBody catalogue={catalogue} entry={entry} />,
  );
}

const row = (label: string) =>
  new RegExp(
    `<span class="mbk-meta-k mbk-reset">${label}</span><span class="mbk-meta-v mbk-reset">([^<]*)</span>`,
  );

test("the Schemes row names each scheme for the reader", () => {
  const markup = details("product/browse/details", (index) => {
    const screen = index.screens.find(
      (candidate) => candidate.path === "product/browse/details",
    );
    assert.ok(screen);
    screen.colorSchemes = ["light", "dark"];
    screen.views = screen.views.flatMap((view, at) => [
      view,
      { ...view, colorScheme: "dark", documentKey: String(at + 1).repeat(64) },
    ]);
  });
  assert.equal(row("Schemes").exec(markup)?.[1], "Light, Dark");
});

test("a removed entry names its folders, and a top-level one has no empty Location row", () => {
  const removed = "product/removed-page";
  const nested = details(removed, (index) => {
    index.removedEntries[0]!.folderTitles = ["Product overview", "Guides"];
  });
  assert.equal(row("Location").exec(nested)?.[1], "Product overview › Guides");
  const top = details(removed, (index) => {
    index.removedEntries[0]!.folderTitles = [];
  });
  assert.doesNotMatch(top, /Location/);
  assert.match(top, /<span class="mbk-meta-k mbk-reset">Source<\/span>/);
});
