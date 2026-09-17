import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "parse5";

import { adaptBrowseDocument } from "../dist/browse/document_adapter.js";
import { inspectorMarkup } from "../dist/browse/inspector_metadata.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";
import {
  readMetadata,
  metadataKeys,
} from "../packages/viewer/dist/inspector/metadata.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("published copies receive only accepted identities after ownership/range validation", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const catalogue = createCatalogue(compilation.manifest);
  const original = compilation.outputs.get("screens/home.mobile.html")!;
  const adapted = adaptBrowseDocument(
    original,
    "screens/home.mobile.html",
    catalogue,
  );
  const json = /<template data-mokly-inspector>(.*?)<\/template>/.exec(
    adapted,
  )![1]!;
  const metadata = readMetadata(json);
  assert.ok(metadata);
  assert.equal(metadata.error, undefined);
  assert.doesNotMatch(json, /props|source|label|componentId|notes\.md|slotKey/);
  if (metadata) {
    assert.ok(metadataKeys(metadata).length > 0);
    assert.deepEqual(metadata.links, [
      { id: "action", target: { kind: "self" } },
    ]);
    assert.ok(metadata.ranges.some((range) => range[1] !== null));
  }
  assert.match(
    adapted,
    /<script src="\/__mokly\/client\/inspector.js" defer><\/script>/,
  );
  assert.match(adapted, /data-mokly-inspector-link="0"/);
  assert.doesNotMatch(original, /inspector.js|data-mokly-inspector/);
  const bodyTags = (html: string) => {
    const document = parse(html);
    const root = document.childNodes.find((node) => node.nodeName === "html");
    if (!root || !("childNodes" in root)) throw new Error("No document root");
    const body = root.childNodes.find((node) => node.nodeName === "body");
    if (!body || !("childNodes" in body)) throw new Error("No document body");
    return body.childNodes.map((node) => node.nodeName);
  };
  assert.deepEqual(bodyTags(adapted), bodyTags(original));
  for (const candidate of [
    original.replace(/<\/?head\b[^>]*>/g, ""),
    original.replace(/<\/?(?:html|head|body)\b[^>]*>/g, ""),
  ]) {
    const copy = adaptBrowseDocument(
      candidate,
      "screens/home.mobile.html",
      catalogue,
    );
    assert.deepEqual(bodyTags(copy), bodyTags(candidate));
    assert.match(copy, /<head><template data-mokly-inspector>/);
  }
  assert.equal(compilation.outputs.get("screens/home.mobile.html"), original);
  const unowned = "<!doctype html><p>Unowned</p>";
  assert.equal(
    adaptBrowseDocument(unowned, "unowned.html", catalogue),
    unowned,
  );
  assert.throws(() =>
    adaptBrowseDocument(
      original.replace(
        "mokly-component:start:r-0",
        "mokly-component:start:r-999",
      ),
      "screens/home.mobile.html",
      catalogue,
    ),
  );
  assert.throws(
    () =>
      adaptBrowseDocument(
        original.replace(
          /<body[^>]*>/,
          "$&<template data-mokly-inspector></template>",
        ),
        "screens/home.mobile.html",
        catalogue,
      ),
    /reserved inspector/,
  );
});

test("oversized or invalid metadata explicitly disables cross-origin inspection", () => {
  const links = Array.from({ length: 1025 }, (_, index) => ({
    id: `link-${index}`,
    target: { kind: "self" as const },
  }));
  assert.match(inspectorMarkup(undefined, links), /"error":"limit"/);
  const huge = Array.from({ length: 1024 }, (_, index) => ({
    id: `link-${index}`,
    fragment: "a".repeat(256),
    target: { kind: "named" as const, name: "a".repeat(256) },
  }));
  assert.match(inspectorMarkup(undefined, huge), /"error":"limit"/);
  for (const value of [
    { ranges: [], links: [], props: {} },
    { ranges: [["invalid", null]], links: [] },
    { ranges: [["a".repeat(64), 1]], links: [] },
    { ranges: [["a".repeat(64), -1]], links: [] },
    { ranges: [["a".repeat(64), "0"]], links: [] },
    { ranges: [["a".repeat(64), null, null]], links: [] },
    {
      ranges: [],
      links: [{ id: "screen", target: { kind: "self", extra: 1 } }],
    },
  ])
    assert.equal(readMetadata(JSON.stringify(value)), undefined);
});

test("export includes the inspector while generated and comparison bytes stay unchanged", async (t) => {
  const fixture = await createExportFixture(componentEntrySource());
  t.after(fixture.close);
  const before = await directoryFiles(fixture.config.mockupsDir);
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  const files = await directoryFiles(fixture.output);
  assert.ok(files.has("__mokly/client/inspector.js"));
  assert.deepEqual(await directoryFiles(fixture.config.mockupsDir), before);
  const snapshotFiles = [...files].filter(
    ([name]) => name.includes("/snapshots/") && name.endsWith(".html"),
  );
  assert.ok(snapshotFiles.length > 0);
  for (const [name, bytes] of snapshotFiles) {
    assert.doesNotMatch(bytes.toString(), /inspector.js|data-mokly-inspector/);
    const relative = name.replace(/^.*\/snapshots\/[^/]+\//, "");
    assert.deepEqual(bytes, before.get(relative), name);
  }
  const inventory = JSON.parse(
    await fs.readFile(
      path.join(fixture.output, ".mokly-export-artifact"),
      "utf8",
    ),
  );
  assert.ok(inventory.files.includes("__mokly/client/inspector.js"));
  assert.ok(result.comparisonUrl);
});

test("repository preview adds its inspector after validating portable consumer resources", async (t) => {
  const fixture = await createExportFixture(componentEntrySource());
  t.after(fixture.close);
  const output = path.join(fixture.root, ".context/preview");
  const original = await directoryFiles(fixture.config.mockupsDir);
  await buildPreview(fixture.config, output);
  const published = await directoryFiles(output);
  assert.ok(published.has("__mokly/client/inspector.js"));
  assert.match(
    published.get("static/screens/home.mobile.html")!.toString(),
    /data-mokly-inspector/,
  );
  assert.deepEqual(await directoryFiles(fixture.config.mockupsDir), original);
  await fs.writeFile(
    path.join(fixture.config.mockupsDir, "unowned.html"),
    '<!doctype html><script src="/__mokly/client/inspector.js"></script>',
  );
  await assert.rejects(
    buildPreview(fixture.config, output),
    /non-portable asset URL/,
  );
  assert.deepEqual(await directoryFiles(output), published);
});
