import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { CatalogueNode } from "../src/catalogue/types.js";
import { EntryDetailsBody } from "../src/shell/details.js";

import { catalogueFixture, indexFixture } from "./catalogue_v9_fixture.js";
import {
  publishedCatalogue,
  publishedDocument,
  publishedScreen,
  removedEntry,
} from "./published_entries_fixture.js";

/** The public fixture, with a screen that names the overview document. */
function catalogue() {
  return catalogueFixture(
    indexFixture((model) => {
      const details = model.screens.find(
        (entry) => entry.path === "product/browse/details",
      );
      assert.ok(details);
      details.details.relatedDocs = ["mock:product", "docs/notes.md"];
      model.documents[0]!.tags = ["guide"];
    }),
  );
}

function details(path: string): string {
  const shell = catalogue();
  const entry = shell.byPath.get(path);
  assert.ok(entry, path);
  return renderToStaticMarkup(
    <EntryDetailsBody catalogue={shell} entry={entry} />,
  );
}

test("a related document opens its entry, labelled with its title", () => {
  const html = details("product/browse/details");
  assert.match(
    html,
    /<a class="mbk-meta-link mbk-reset" href="\/view\/product\/">Product overview<\/a>/u,
  );
  assert.match(
    html,
    /<code class="mbk-code mbk-reset">docs\/notes\.md<\/code>/u,
  );
  assert.doesNotMatch(html, /mock:product/u);
});

test("a document's Details show its description, tags, and Markdown source", () => {
  const html = details("product");
  const shell = catalogue();
  const entry = shell.byPath.get("product");
  assert.ok(entry?.kind === "document");
  assert.match(html, new RegExp(`>${entry.details.description}</p>`, "u"));
  assert.match(html, /data-mokly-tag="guide"/u);
  assert.match(
    html,
    new RegExp(
      `Source</span>.*?<code class="mbk-code mbk-reset">${entry.details.sourcePath}`,
      "u",
    ),
  );
  assert.doesNotMatch(html, /Why this document/u);
});

/** The Guide folder, which holds the current Payment terms document. */
const GUIDE: CatalogueNode = {
  children: [{ kind: "entry", path: "guide/terms" }],
  kind: "folder",
  path: "guide",
  title: "Guide",
};

test("the catalogue record's source path links its current document", () => {
  const related = ["specs/guide/terms.md", "specs/guide/old.md", "x.md"];
  const billing = publishedScreen("billing", "Billing");
  billing.details.relatedDocs = [...related];
  const invoices = publishedScreen("invoices", "Invoices", "removed");
  invoices.details.relatedDocs = [...related];
  const shell = publishedCatalogue({
    documents: [publishedDocument("guide/terms", "Payment terms")],
    removedEntries: [
      removedEntry(publishedDocument("guide/old", "Old terms", "removed"), [
        "Guide",
      ]),
      removedEntry(invoices, []),
    ],
    screens: [billing],
    tree: [{ kind: "entry", path: "billing" }, GUIDE],
  });
  const render = (path: string) => {
    const entry = shell.byPath.get(path);
    assert.ok(entry, path);
    return renderToStaticMarkup(
      <EntryDetailsBody catalogue={shell} entry={entry} />,
    );
  };
  const current = render("billing");
  assert.match(
    current,
    /<a class="mbk-meta-link mbk-reset" href="\/view\/guide\/terms\/">Payment terms<\/a><code class="mbk-code mbk-reset">specs\/guide\/old\.md<\/code><code class="mbk-code mbk-reset">x\.md<\/code>/u,
  );
  const removed = render("invoices");
  assert.doesNotMatch(removed, /mbk-meta-link/u);
  assert.match(
    removed,
    /<code class="mbk-code mbk-reset">specs\/guide\/terms\.md<\/code>/u,
  );
});

test("a served document shows its source without the removed dependency list", () => {
  const shell = publishedCatalogue({
    documents: [publishedDocument("guide/terms", "Payment terms")],
    tree: [GUIDE],
  });
  const published = shell.byPath.get("guide/terms");
  assert.ok(published);
  const document = published;
  const markup = renderToStaticMarkup(
    <EntryDetailsBody catalogue={shell} entry={document} />,
  );
  assert.match(markup, /Source<\/span>.*specs\/guide\/terms\.md/u);
  assert.doesNotMatch(markup, /Dependencies|terms\.svg/u);
});
