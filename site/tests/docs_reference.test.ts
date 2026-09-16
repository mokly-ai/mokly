import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { DOCS_PAGES } from "../src/docs/pages.js";
import {
  REFERENCE_DIRECTORY,
  REFERENCE_DOCUMENTS,
  publishedDocument,
  referenceFile,
  referenceRoute,
  documentForEntry,
} from "../src/docs/reference-allowlist.js";
import {
  GITHUB_BLOB,
  relativeLinks,
  repositoryRelative,
  rewriteHref,
} from "../src/docs/reference.js";
import { repositoryPath } from "../src/workspace.js";

const source = (document: { source: string }) =>
  readFileSync(repositoryPath(document.source), "utf8");

test("every allowlisted document exists and names its own title", () => {
  assert.ok(REFERENCE_DOCUMENTS.length > 0);
  for (const document of REFERENCE_DOCUMENTS) {
    assert.ok(
      existsSync(repositoryPath(document.source)),
      `${document.source} is allowlisted but absent`,
    );
    assert.match(source(document), /^# .+\n/, document.source);
    assert.equal(
      document.source,
      `${REFERENCE_DIRECTORY}/${referenceFile(document)}`,
    );
    assert.equal(
      documentForEntry(referenceFile(document).replace(/\.md$/, "")),
      document,
    );
  }
});

test("the reference section publishes the allowlist and nothing else", () => {
  const published = DOCS_PAGES.filter((page) => page.section === "reference");
  assert.deepEqual(
    published.map((page) => page.route),
    REFERENCE_DOCUMENTS.map((document) => referenceRoute(document.slug)),
  );
  const orders = REFERENCE_DOCUMENTS.map((document) => document.order);
  assert.deepEqual(
    orders,
    [...orders].sort((left, right) => left - right),
  );
  assert.equal(
    new Set(REFERENCE_DOCUMENTS.map((d) => d.slug)).size,
    orders.length,
  );
});

test("no excluded protocol document is reachable from the site", () => {
  const directory = repositoryPath(REFERENCE_DIRECTORY);
  const excluded = readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${REFERENCE_DIRECTORY}/${name}`)
    .filter((file) => !REFERENCE_DOCUMENTS.some((d) => d.source === file));
  assert.ok(
    excluded.length > 0,
    "the protocol holds documents the site keeps out",
  );
  for (const file of excluded) {
    assert.equal(publishedDocument(file), undefined, file);
    assert.equal(
      rewriteHref(
        `./${path.basename(file)}`,
        `${REFERENCE_DIRECTORY}/mokly-upload.md`,
      ),
      `${GITHUB_BLOB}${file}`,
    );
  }
});

test("links are rewritten to the site, to GitHub, or left alone", () => {
  const from = "docs/protocol/mokly-upload.md";
  assert.equal(
    rewriteHref("./mokly-export-delivery.md", from),
    "/docs/reference/export-delivery/",
  );
  assert.equal(
    rewriteHref("./mokly-export-delivery.md#hosting-contract", from),
    "/docs/reference/export-delivery/#hosting-contract",
  );
  assert.equal(
    rewriteHref("../../plans/publish-catalogue.md", from),
    `${GITHUB_BLOB}plans/publish-catalogue.md`,
  );
  assert.equal(rewriteHref("/README.md", from), `${GITHUB_BLOB}README.md`);
  assert.equal(rewriteHref("#limits", from), "#limits");
  assert.equal(
    rewriteHref("https://example.com/x", from),
    "https://example.com/x",
  );
  assert.equal(
    rewriteHref("mailto:hi@example.com", from),
    "mailto:hi@example.com",
  );
});

test("every relative link in a published document reaches a real place", () => {
  for (const document of REFERENCE_DOCUMENTS) {
    const links = relativeLinks(source(document));
    assert.ok(links.length > 0, `${document.slug} links to nothing`);
    for (const href of links) {
      const rewritten = rewriteHref(href, document.source);
      assert.ok(
        rewritten.startsWith("/docs/reference/") ||
          rewritten.startsWith(GITHUB_BLOB),
        `${document.slug}: ${href} was not rewritten`,
      );
      if (rewritten.startsWith(GITHUB_BLOB)) {
        const file = rewritten.slice(GITHUB_BLOB.length).split("#")[0] ?? "";
        assert.ok(
          existsSync(repositoryPath(file)),
          `${document.slug}: ${href} leads to ${file}, which is not in the repository`,
        );
      }
    }
  }
});

test("a repository path is resolved against the repository root", () => {
  assert.equal(
    repositoryRelative(repositoryPath("docs", "protocol", "mokly-upload.md")),
    "docs/protocol/mokly-upload.md",
  );
});
