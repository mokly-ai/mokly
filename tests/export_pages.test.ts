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
mockups.push(definePage({ id: "handbook", title: ${JSON.stringify(title)}, description: "Catalogue guidance", dependencies: [], navPath: ["Library"], relatedDocs: [], render: () => '<!doctype html><html><body><h1 id="start">Handbook</h1><a href="mock:home">Home</a></body></html>' }));`;
}

test("consumer export builds unified pages and preserves a removed page's baseline context", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  const initial = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(initial.idRoutes["handbook"], "/view/pages/handbook.html");
  const read = (name: string) =>
    fs.readFile(path.join(fixture.output, name), "utf8");
  assert.match(await read("id/handbook/index.html"), /Handbook/);
  assert.match(
    await read("static/pages/handbook.html"),
    /data-mokly-link="home"/,
  );
  assert.doesNotMatch(
    await read("view/pages/handbook.html"),
    /data-diff-screen|data-viewport-option/,
  );
  await fs.writeFile(fixture.entryPath, validEntrySource());
  const removed = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(removed.idRoutes["handbook"], "/view/pages/handbook.html");
  assert.match(
    documentText(await read("view/pages/handbook.html")),
    /Showing previous version/,
  );
  assert.match(
    await read("view/pages/handbook.html"),
    /Catalogue location[^>]*>.*Library/,
  );
  assert.doesNotMatch(
    await read("view/pages/handbook.html"),
    /<iframe|data-diff-screen/,
  );
  assert.match(await read("index.html"), /data-removed-page=""/);
  assert.doesNotMatch(
    await read("index.html"),
    /data-nav-folder="folder:library"/,
  );
});

test("renamed pages retain one derived route and current static id alias", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, pageSource("Updated handbook"));
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(result.idRoutes["handbook"], "/view/pages/handbook.html");
  const alias = await fs.readFile(
    path.join(fixture.output, "id/handbook/index.html"),
    "utf8",
  );
  assert.doesNotMatch(documentText(alias), /Showing previous version/);
  const current = await fs.readFile(
    path.join(fixture.output, "view/pages/handbook.html"),
    "utf8",
  );
  assert.doesNotMatch(documentText(current), /Showing previous version/);
  assert.match(documentText(current), /Updated handbook/);
});
