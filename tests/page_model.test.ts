import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { entryRoute } from "../packages/viewer/src/navigation/routes.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { buildNavSections } from "../packages/viewer/src/shell/nav_tree.js";
import { compileCatalogue } from "../src/build/compile.js";
import { loadConfig } from "../src/config/load.js";
import { changedManifestPaths } from "../src/registry/changed_paths.js";
import { removedManifestEntries } from "../src/registry/changes.js";
import { viewPage, homePage } from "../src/server/pages.js";

import { assertAbsent, entryAt } from "./helpers/catalogue_selection.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { documentText } from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";

function source(parent: "app" | "book" = "book", title = "Handbook") {
  const entryPath = parent === "app" ? "app/handbook" : "app/book/handbook";
  return `import { definePage } from "@mokly/mokly";
const meta = { dependencies: [], relatedDocs: [], description: "Example" };
export const mockups = [
 definePage({...meta, path: "${entryPath}", title: ${JSON.stringify(title)}, tags: ["documents"], render: () => "<!doctype html><html><body>Handbook</body></html>"}),
 ${parent === "app" ? 'definePage({...meta, path: "app/book/second", title: "Second", render: () => "<html><body>Second</body></html>"}),' : ""}
];`;
}

test("page path changes create an addition and a removal", async (context) => {
  const fixture = await createFixture(source());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const before = (await compileCatalogue(config)).manifest;
  await fs.promises.writeFile(
    fixture.entryPath,
    source("app", "Renamed handbook"),
  );
  const after = (await compileCatalogue(config)).manifest;
  const handbook = entryAt(after, "app/handbook", "page");
  assert.equal(
    handbook?.kind === "page" ? entryRoute(handbook.path) : undefined,
    "app/handbook/index.html",
  );
  assert.ok(
    changedManifestPaths(after, before, config, []).includes("app/handbook"),
  );
  const removed = removedManifestEntries(after, before);
  assert.deepEqual(
    removed.map(({ entry }) => [entry.kind, entry.path]),
    [["page", "app/book/handbook"]],
  );
  assert.deepEqual(removed[0]?.folderTitles, ["App", "Book"]);
  assertAbsent(after, "app/book/handbook");
  const catalogue = createCatalogue(after);
  assert.deepEqual(
    buildNavSections(catalogue.hierarchy)[0]!
      .children.filter((entry) => entry.kind === "group")
      .map((entry) => entry.label),
    ["App"],
  );
  assert.deepEqual(catalogue.hierarchy.ancestorsByPath.get("app/handbook"), [
    "App",
  ]);
});

test("removed page metadata keeps deleted ancestry and current path precedence", async (context) => {
  const fixture = await createFixture(source());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseline = (await compileCatalogue(config)).manifest;
  const removed = removedManifestEntries(
    { ...baseline, entries: [] },
    baseline,
  );
  assert.deepEqual(removed[0]?.folderTitles, ["App", "Book"]);
  const catalogue = createCatalogue({ ...baseline, entries: [] }, removed);
  const entry = removed[0]!.entry;
  const html = viewPage(entry, catalogue, {
    ...publicShellContext(catalogue, {
      base: "main",
      updateVersion: 1,
      changedEntries: [entry.path],
    }),
  });
  assert.match(documentText(html), /Showing previous version/);
  assert.match(documentText(html), /App.*Book/s);
  assert.doesNotMatch(html, /data-diff-screen|data-nav-folder=/);
  assert.match(
    homePage(
      catalogue,
      publicShellContext(catalogue, {
        base: "main",
        updateVersion: 1,
        changedEntries: [entry.path],
      }),
    ),
    /data-removed-page=""[^>]*hidden/,
  );
  await fs.promises.writeFile(fixture.entryPath, source("book", "New"));
  const current = (await compileCatalogue(config)).manifest;
  const moved = removedManifestEntries(current, baseline);
  assert.equal(moved.length, 0);
  assert.equal(
    createCatalogue(current, moved).byPath.get("app/book/handbook")?.title,
    "New",
  );
  assert.equal(removedManifestEntries(baseline, baseline).length, 0);
});

test("folder title changes preserve page paths and update breadcrumbs", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const title of ["Book", "Renamed", "Moved"]) {
    await fs.promises.writeFile(
      fixture.entryPath,
      `import {defineFolder,definePage} from "@mokly/mokly";
export const folders = defineFolder({path:"app/book",title:${JSON.stringify(title)}});
export default definePage({path:"app/book/handbook",title:"Handbook",description:"Notes",dependencies:["notes.md"],relatedDocs:["notes.md"],render:()=>"<html><body>Guide</body></html>"});`,
    );
    const manifest = (await compileCatalogue(config)).manifest;
    const entry = manifest.entries.find((value) => value.kind === "page");
    assert.ok(entry);
    assert.equal(entryRoute(entry.path), "app/book/handbook/index.html");
    assert.deepEqual(
      createCatalogue(manifest).hierarchy.ancestorsByPath.get(entry.path),
      ["App", title],
    );
    assert.deepEqual(entry.relatedDocs, ["notes.md"]);
  }
});
