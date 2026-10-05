import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { renderViewer } from "../src/viewer/server.js";

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v5.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

function render(screenPath: string | null): string {
  return renderViewer({
    viewerId: "fixture",
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenPath },
  });
}

function element(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  assert.ok(match, String(pattern));
  return match[0];
}

test("a folder's own document is its first row, labelled Overview with the document icon", () => {
  const html = render("product");
  const folder = element(
    html,
    /<details class="mbk-nav-group" data-nav-folder="folder:product"[\s\S]*?<\/summary>[\s\S]*?<\/a>/,
  );
  const row = element(folder, /<a [^>]*data-entry-id="product"[\s\S]*?<\/a>/);
  assert.match(row, /aria-current="page"/);
  assert.match(row, /data-entry-kind="document"/);
  assert.match(row, /data-nav-index=""/);
  assert.match(
    row,
    /<path d="M9 13h6M9 17h4"><\/path><\/svg><\/span>Overview</,
  );
  assert.match(folder, /<span class="mbk-nav-label">Product overview<\/span>/);
});

test("the Specs section holds every kind but components, which keep their own section", () => {
  const html = render(null);
  assert.match(
    html,
    /data-nav-disclosure="section:specs" data-nav-section="specs"/,
  );
  assert.match(
    html,
    /data-nav-disclosure="section:components" data-nav-section="components"/,
  );
  assert.doesNotMatch(html, /section:pages|data-nav-section="pages"/);
  const specs = element(
    html,
    /data-nav-section="specs"[\s\S]*?(?=data-nav-section="components")/,
  );
  assert.doesNotMatch(specs, /data-entry-kind="component"/);
  for (const kind of ["document", "page", "screen", "use-case"])
    assert.match(specs, new RegExp(`data-entry-kind="${kind}"`), kind);
});

test("breadcrumbs link a folder's page and reveal a folder without one", () => {
  const html = render("product/browse/home");
  const crumbs = element(
    html,
    /<p aria-label="Catalogue location"[\s\S]*?<\/p>/,
  );
  assert.match(
    crumbs,
    /<a class="mbk-crumb-link" href="\/view\/product\/">Product overview<\/a>/,
  );
  assert.match(
    crumbs,
    /<button class="mbk-crumb-link" data-crumb-folder="product\/browse" type="button">Browse<\/button>/,
  );
});

test("component details show the shown entry's path above its source", () => {
  const html = render("components/action/default");
  assert.match(
    html,
    /Path<\/[^>]+>[\s\S]{0,120}<code class="mbk-code">components\/action\/default<\/code>[\s\S]*?Source/,
  );
});
