import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { buildNavTree } from "../packages/viewer/src/shell/nav_tree.js";
import { compileCatalogue } from "../src/build/compile.js";
import { loadConfig } from "../src/config/load.js";
import { changedManifestRoutes } from "../src/registry/changed_routes.js";
import { removedManifestEntries } from "../src/registry/changes.js";
import { viewPage, homePage } from "../src/server/pages.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

function source(
  parent: "app" | "book" = "book",
  title = "Handbook",
  path = "explicit/handbook.html",
) {
  return `import { defineCollection, definePage } from "@mokly/mokly";
const meta = { dependencies: [], relatedDocs: [], description: "Example" };
export const mockups = [
 defineCollection({...meta, id: "app", title: "App", childIds: ["book"${parent === "app" ? ', "handbook"' : ""}]}),
 defineCollection({...meta, id: "book", title: "Book", childIds: ${parent === "book" ? '["handbook"]' : '["second"]'}}),
 definePage({...meta, id: "handbook", title: ${JSON.stringify(title)}, route: ${JSON.stringify(path)}, tags: ["documents"], render: () => "<!doctype html><html><body>Handbook</body></html>"}),
 ${parent === "app" ? 'definePage({...meta, id: "second", title: "Second", route: "second.html", render: () => "<html><body>Second</body></html>"}),' : ""}
];`;
}

test("flat page titles and memberships affect Changes without rewriting explicit routes", async (context) => {
  const fixture = await createFixture(source());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const before = (await compileCatalogue(config)).manifest;
  await fs.promises.writeFile(
    fixture.entryPath,
    source("app", "Renamed handbook"),
  );
  const after = (await compileCatalogue(config)).manifest;
  const handbook = after.entries.find((entry) => entry.id === "handbook");
  assert.equal(
    handbook?.kind === "page" ? handbook.route : undefined,
    "explicit/handbook.html",
  );
  assert.ok(
    changedManifestRoutes(after, before, config, []).includes(
      "explicit/handbook.html",
    ),
  );
  const catalogue = createCatalogue(after);
  assert.deepEqual(
    buildNavTree(catalogue.hierarchy)
      .filter((entry) => entry.kind === "group")
      .map((entry) => entry.label),
    ["App"],
  );
  assert.deepEqual(
    catalogue.hierarchy.ancestorsById
      .get("handbook")
      ?.map((entry) => entry.title),
    ["App"],
  );
});

test("removed page metadata keeps deleted ancestry and current route/id precedence", async (context) => {
  const fixture = await createFixture(source());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseline = (await compileCatalogue(config)).manifest;
  const removed = removedManifestEntries(
    { ...baseline, entries: [] },
    baseline,
  );
  assert.deepEqual(removed[0]?.ancestors, [
    { id: "app", title: "App" },
    { id: "book", title: "Book" },
  ]);
  const catalogue = createCatalogue({ ...baseline, entries: [] }, removed);
  const entry = removed[0]!.entry;
  const html = viewPage(entry, catalogue, {
    base: "main",
    updateVersion: 1,
    changedRoutes: [entry.route],
  });
  assert.match(html, /This page was removed/);
  assert.match(html, /App.*Book/s);
  assert.doesNotMatch(html, /data-diff-screen|data-nav-collection=/);
  assert.match(
    homePage(catalogue, {
      base: "main",
      updateVersion: 1,
      changedRoutes: [entry.route],
    }),
    /data-removed-page=""[^>]*hidden/,
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    source("book", "New", "new.html"),
  );
  const current = (await compileCatalogue(config)).manifest;
  const moved = removedManifestEntries(current, baseline);
  assert.equal(moved.length, 1);
  assert.equal(
    createCatalogue(current, moved).byId.get("handbook")?.title,
    "New",
  );
  assert.equal(removedManifestEntries(baseline, baseline).length, 0);
});

test("nested page slugs and ancestor path segments alone derive their URLs", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const nested = (
    title: string,
    segment: string,
  ) => `import { defineRoot, collection, page } from "@mokly/mokly";
export const mockups = defineRoot({ path: "app", collection: { id: "app", title: "App", description: "App", dependencies: ["notes.md"], relatedDocs: ["notes.md"], address: "ignored" }, children: [collection({id: "book", title: ${JSON.stringify(title)}, description: "Book", segment: ${JSON.stringify(segment)}, children: [page({id: "handbook", title: "Handbook", description: "Notes", slug: "guide", render: () => "<html><body>Guide</body></html>"})]})]});`;
  for (const [title, segment] of [
    ["Book", "book"],
    ["Renamed", "book"],
    ["Moved", "archive"],
  ]) {
    await fs.promises.writeFile(fixture.entryPath, nested(title!, segment!));
    const entry = (await compileCatalogue(config)).manifest.entries.find(
      (value) => value.kind === "page",
    );
    assert.equal(
      entry?.kind === "page" ? entry.route : undefined,
      `app/${segment}/guide.html`,
    );
    assert.deepEqual(entry?.relatedDocs, ["notes.md"]);
    assert.equal("address" in entry!, false);
  }
});
