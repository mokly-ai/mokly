import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

function pageSource(route = "handbook.html"): string {
  return `${validEntrySource()}
import { definePage } from "@mokly/mokly";
mockups.push(defineCollection({ id: "library", title: "Library", description: "Documents", dependencies: [], relatedDocs: [], childIds: ["handbook"] }),
definePage({ id: "handbook", title: "Handbook", description: "Catalogue guidance", dependencies: [], relatedDocs: [], route: ${JSON.stringify(route)}, render: () => '<!doctype html><html><body><h1 id="start">Handbook</h1><a href="mock:home">Home</a></body></html>' }));`;
}

test("consumer export builds unified pages and preserves a removed page's baseline context", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  const initial = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(initial.idRoutes["handbook"], "/view/handbook.html");
  const read = (name: string) =>
    fs.readFile(path.join(fixture.output, name), "utf8");
  assert.match(await read("id/handbook/index.html"), /Handbook/);
  assert.match(await read("static/handbook.html"), /data-mokly-link="home"/);
  assert.doesNotMatch(
    await read("view/handbook.html"),
    /data-diff-screen|data-viewport-option/,
  );
  await fs.writeFile(fixture.entryPath, validEntrySource());
  const removed = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(removed.idRoutes["handbook"], "/view/handbook.html");
  assert.match(await read("view/handbook.html"), /Showing previous version/);
  assert.match(
    await read("view/handbook.html"),
    /Catalogue location[^>]*>.*Library/,
  );
  assert.doesNotMatch(
    await read("view/handbook.html"),
    /<iframe|data-diff-screen/,
  );
  assert.match(await read("index.html"), /data-removed-page=""/);
  assert.doesNotMatch(
    await read("index.html"),
    /data-nav-collection="collection:library"/,
  );
});

test("renamed pages retain their old route while the static id resolves to current content", async (context) => {
  const fixture = await createExportFixture(pageSource());
  context.after(() => fixture.close());
  await fs.writeFile(fixture.entryPath, pageSource("guides/handbook.html"));
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(result.idRoutes["handbook"], "/view/guides/handbook.html");
  const alias = await fs.readFile(
    path.join(fixture.output, "id/handbook/index.html"),
    "utf8",
  );
  assert.doesNotMatch(alias, /Showing previous version/);
  assert.match(
    await fs.readFile(path.join(fixture.output, "view/handbook.html"), "utf8"),
    /Showing previous version/,
  );
});
