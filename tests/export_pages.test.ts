import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { documentText } from "./helpers/html.js";

function pageSource(title = "Handbook"): string {
  return `${validEntrySource()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ path: "library/handbook", title: ${JSON.stringify(title)}, description: "Catalogue guidance", dependencies: [], relatedDocs: [], render: () => '<!doctype html><html><body><h1 id="start">Handbook</h1><a href="mock:home">Home</a></body></html>' }));`;
}

test("consumer export builds unified pages and preserves a removed page's baseline context", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const read = (name: string) =>
    fs.readFile(path.join(fixture.output, name), "utf8");
  await assert.rejects(fs.access(path.join(fixture.output, "id")));
  assert.match(
    await read("static/library/handbook/index.html"),
    /data-mokly-link="home"/,
  );
  assert.doesNotMatch(
    await read("view/library/handbook/index.html"),
    /data-diff-screen|data-viewport-option/,
  );
  await fs.writeFile(fixture.entryPath, validEntrySource());
  await exportCatalogue(fixture.config, { outDir: "site" });
  assert.match(
    documentText(await read("view/library/handbook/index.html")),
    /Showing previous version/,
  );
  assert.match(
    await read("view/library/handbook/index.html"),
    /Catalogue location[^>]*>.*Library/,
  );
  assert.doesNotMatch(
    await read("view/library/handbook/index.html"),
    /<iframe|data-diff-screen/,
  );
  assert.match(await read("index.html"), /data-removed-page=""/);
  assert.doesNotMatch(
    await read("index.html"),
    /data-nav-folder="folder:library"/,
  );
});

test("renamed pages retain one derived route without a static alias", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, pageSource("Updated handbook"));
  await exportCatalogue(fixture.config, { outDir: "site" });
  await assert.rejects(fs.access(path.join(fixture.output, "id")));
  const current = await fs.readFile(
    path.join(fixture.output, "view/library/handbook/index.html"),
    "utf8",
  );
  assert.doesNotMatch(documentText(current), /Showing previous version/);
  assert.match(documentText(current), /Updated handbook/);
});
