import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { discoverEntries } from "../packages/mokly/dist/config/entry_discovery.js";
import { loadDocuments } from "../packages/mokly/dist/documents/load.js";

import { pathFixture } from "./helpers/path_fixture.js";

test("matched mdx and markdown files never become document definitions", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/guide.md": "# Guide",
      "specs/extended.mdx": "# Not a document",
      "specs/long.markdown": "# Not a document",
    },
    '{mockupsDir:"generated",roots:[{dir:"specs",files:["**/*.{md,mdx,markdown}"]}]}',
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  const discovery = discoverEntries(config);
  const names = (files: readonly string[]) =>
    files.map((file) => path.relative(fixture.root, file));
  assert.deepEqual(names(discovery.resolvedFiles), [
    "specs/extended.mdx",
    "specs/guide.md",
    "specs/long.markdown",
  ]);
  assert.deepEqual(names(discovery.entryModules), [
    "specs/extended.mdx",
    "specs/long.markdown",
  ]);
  const documents = loadDocuments(config, discovery);
  assert.deepEqual(
    documents.entries.map((entry) => [entry.kind, entry.path]),
    [["document", "guide"]],
  );
});

test("a BOM preserves all front matter and a declared folder index identity", async (t) => {
  const fixture = await pathFixture({
    "specs/account/README.md":
      '\uFEFF---\ntitle: Chosen\ndescription: Details\ntags: ["guide"]\npath: published\nmovedFrom: old\n---\n# Body\n\n[Child](mock:./child)',
    "specs/account/child.md": "---\npath: published/child\n---\n# Child",
  });
  t.after(fixture.remove);
  const { manifest, outputs } = await fixture.compile();
  const entry = manifest.entries[0]!;
  assert.equal(entry.kind, "document");
  assert.equal(entry.path, "published");
  assert.equal(entry.title, "Chosen");
  assert.equal(entry.description, "Details");
  assert.deepEqual(entry.tags, ["guide"]);
  assert.equal(entry.movedFrom, "old");
  assert.ok(outputs.has("published/index.html"));
  assert.ok(
    (outputs.get("published/index.html") as string).includes(
      'data-mokly-link="published/child"',
    ),
  );
});

test("empty headings fall through to a real heading and then to the file name", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md": "#\n\n## Real",
    "specs/fallback-title.md": "#\n\n##",
  });
  t.after(fixture.remove);
  assert.deepEqual(
    (await fixture.compile()).manifest.entries.map((entry) => [
      entry.path,
      entry.title,
    ]),
    [
      ["fallback-title", "Fallback title"],
      ["guide", "Real"],
    ],
  );
});
