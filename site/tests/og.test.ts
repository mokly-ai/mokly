import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { DOCS_PAGES } from "../src/docs/pages.js";
import { PAGE_METADATA, socialSlug } from "../src/metadata.js";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardDocument,
  cardTitle,
  cards,
  wrapTitle,
} from "../src/og.js";
import { sitePath } from "../src/workspace.js";

test("the card leads with the page, not the repeated site name", () => {
  assert.equal(cardTitle("Changelog · Mokly"), "Changelog");
  assert.equal(cardTitle("Mokly"), "Mokly");
  assert.equal(cardTitle("Page not found · Mokly"), "Page not found");
});

test("a long title wraps and never runs past three lines", () => {
  assert.deepEqual(wrapTitle("Changelog"), ["Changelog"]);
  assert.deepEqual(
    wrapTitle("Design in your repository, decide in the pull request"),
    ["Design in your repository,", "decide in the pull request"],
  );
  assert.ok(
    wrapTitle("one two three four five six seven eight nine ten").length <= 3,
  );
});

test("the card is drawn at the declared size with the title escaped", () => {
  const document = cardDocument("Terms & <Privacy> · Mokly");
  assert.ok(document.startsWith("<svg "));
  assert.ok(document.includes(`width="${CARD_WIDTH}"`));
  assert.ok(document.includes(`height="${CARD_HEIGHT}"`));
  assert.ok(document.includes("Terms &amp; &lt;Privacy&gt;"));
  assert.ok(!document.includes("· Mokly"));
  assert.ok(document.includes("mokly"), "the card carries the wordmark");
});

test("one card is drawn for every published document", () => {
  const drawn = cards();
  assert.deepEqual(
    [...drawn.keys()].sort(),
    [...Object.keys(PAGE_METADATA), ...DOCS_PAGES.map((page) => page.route)]
      .map((route) => `${socialSlug(route)}.png`)
      .sort(),
  );
  assert.ok(drawn.has("docs-cli-serve.png"), "a documentation page has a card");
});

test("the build rasterized every card into the site output", () => {
  for (const file of cards().keys()) {
    const card = path.join(sitePath("dist"), "og", file);
    assert.ok(statSync(card).size > 0, file);
    assert.equal(
      readFileSync(card).subarray(1, 4).toString("latin1"),
      "PNG",
      file,
    );
  }
});
