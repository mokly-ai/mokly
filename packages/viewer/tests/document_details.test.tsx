import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { currentManifest } from "../../../tests/helpers/current_manifest.js";
import { readCatalogue } from "../src/catalogue/reader.js";
import type { ManifestEntry } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { EntryDetailsBody } from "../src/shell/details.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

/** The public fixture, with a screen that names the overview document. */
function catalogue() {
  const model = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v5.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const details = model.screens.find(
    (entry: { path: string }) => entry.path === "product/browse/details",
  );
  details.details.relatedDocs = ["mock:product", "docs/notes.md"];
  const document = model.documents[0];
  document.tags = ["guide"];
  return viewerCatalogue(readCatalogue(model));
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
    /<a class="mbk-meta-link" href="\/view\/product\/">Product overview<\/a>/u,
  );
  assert.match(html, /<code class="mbk-code">docs\/notes\.md<\/code>/u);
  assert.doesNotMatch(html, /mock:product/u);
});

test("a document's Details show its description, tags, and Markdown source", () => {
  const html = details("product");
  const shell = catalogue();
  const entry = shell.byPath.get("product");
  assert.ok(entry?.kind === "document");
  assert.match(html, new RegExp(`>${entry.description}</p>`, "u"));
  assert.match(html, /data-mokly-tag="guide"/u);
  assert.match(
    html,
    new RegExp(
      `Source</span>.*?<code class="mbk-code">${entry.sourcePath}`,
      "u",
    ),
  );
  assert.doesNotMatch(html, /Why this document/u);
});

const manifestEntry = (
  kind: "document" | "screen",
  path: string,
  title: string,
  relatedDocs: readonly string[] = [],
): ManifestEntry =>
  ({
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: title,
    kind,
    path,
    relatedDocs,
    sourcePath: `specs/${path}.${kind === "document" ? "md" : "mockup.tsx"}`,
    title,
    ...(kind === "screen" ? { useCasePaths: [] } : { resources: [] }),
  }) as unknown as ManifestEntry;

test("the served manifest's source path links its current document", () => {
  const related = ["specs/guide/terms.md", "specs/guide/old.md", "x.md"];
  const shell = createCatalogue(
    currentManifest({
      entries: [
        manifestEntry("screen", "billing", "Billing", related),
        manifestEntry("document", "guide/terms", "Payment terms"),
      ],
      folders: [],
      generatedBy: "mokly",
      schemaVersion: 9,
      sourceFiles: [],
    }),
    [
      {
        entry: manifestEntry("document", "guide/old", "Old terms"),
        folderTitles: ["Guide"],
      },
      {
        entry: manifestEntry("screen", "invoices", "Invoices", related),
        folderTitles: [],
      },
    ],
  );
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
    /<a class="mbk-meta-link" href="\/view\/guide\/terms\/">Payment terms<\/a><code class="mbk-code">specs\/guide\/old\.md<\/code><code class="mbk-code">x\.md<\/code>/u,
  );
  const removed = render("invoices");
  assert.doesNotMatch(removed, /mbk-meta-link/u);
  assert.match(
    removed,
    /<code class="mbk-code">specs\/guide\/terms\.md<\/code>/u,
  );
});

test("a served document lists its resources under Dependencies, as projection does", () => {
  const document = {
    ...manifestEntry("document", "guide/terms", "Payment terms"),
    resources: ["specs/guide/terms.svg"],
  } as ManifestEntry;
  const shell = createCatalogue(
    currentManifest({
      entries: [document],
      folders: [],
      generatedBy: "mokly",
      schemaVersion: 9,
      sourceFiles: [],
    }),
  );
  assert.match(
    renderToStaticMarkup(
      <EntryDetailsBody catalogue={shell} entry={document} />,
    ),
    /Dependencies<\/span><span class="mbk-meta-v"><span class="mbk-chips"><code class="mbk-code">specs\/guide\/terms\.md<\/code><code class="mbk-code">specs\/guide\/terms\.svg<\/code><\/span>/u,
  );
});
