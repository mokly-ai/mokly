import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "@mokly/model";

import { EntryInspectHead } from "../src/shell/inspect_head.js";

import { catalogueFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { storeMarkup } from "./shell_markup.js";

/** The Details body of one current or removed entry of the edited fixture. */
function details(path: string, edit: (index: CatalogueReadModel) => void) {
  const catalogue = catalogueFixture(indexFixture(edit));
  const entry =
    catalogue.entries.find((candidate) => candidate.path === path) ??
    catalogue.removedEntries.find((record) => record.entry.path === path)
      ?.entry;
  assert.ok(entry, path);
  return storeMarkup(<EntryInspectHead catalogue={catalogue} entry={entry} />);
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

test("a screen's declared address follows its source in a code chip, and a screen without one has no Address row", () => {
  const home = "product/browse/home";
  const markup = details(home, (index) => {
    const screen = index.screens.find((candidate) => candidate.path === home);
    assert.ok(screen);
    screen.address = "example.test/welcome";
  });
  assert.match(
    markup,
    /Source<\/span><span class="mbk-meta-v mbk-reset"><code class="mbk-code mbk-reset">[^<]*<\/code><\/span><\/div><div class="mbk-meta-row mbk-reset" data-inspect-address=""><span class="mbk-meta-k mbk-reset">Address<\/span><span class="mbk-meta-v mbk-reset"><code class="mbk-code mbk-reset">example\.test\/welcome<\/code><\/span><\/div>/,
  );
  assert.doesNotMatch(
    details(home, () => {}),
    /data-inspect-address|>Address</,
  );
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
