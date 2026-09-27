import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { entryRoute } from "../packages/viewer/src/navigation/routes.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { buildNavSections } from "../packages/viewer/src/shell/nav_tree.js";
import { compileCatalogue } from "../src/build/compile.js";
import { loadConfig } from "../src/config/load.js";
import { changedManifestIds } from "../src/registry/changed_ids.js";
import { removedManifestEntries } from "../src/registry/changes.js";
import { viewPage, homePage } from "../src/server/pages.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { documentText } from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";

function source(parent: "app" | "book" = "book", title = "Handbook") {
  return `import { definePage } from "@mokly/mokly";
const meta = { dependencies: [], relatedDocs: [], description: "Example" };
export const mockups = [
 definePage({...meta, id: "handbook", title: ${JSON.stringify(title)}, navPath: ${JSON.stringify(parent === "app" ? ["App"] : ["App", "Book"])}, tags: ["documents"], render: () => "<!doctype html><html><body>Handbook</body></html>"}),
 ${parent === "app" ? 'definePage({...meta, id: "second", title: "Second", navPath: ["App", "Book"], render: () => "<html><body>Second</body></html>"}),' : ""}
];`;
}

test("flat page titles and memberships affect Changes without moving derived routes", async (context) => {
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
    handbook?.kind === "page" ? entryRoute("page", handbook.id) : undefined,
    "pages/handbook.html",
  );
  assert.ok(changedManifestIds(after, before, config, []).includes("handbook"));
  const catalogue = createCatalogue(after);
  assert.deepEqual(
    buildNavSections(catalogue.hierarchy)[0]!
      .children.filter((entry) => entry.kind === "group")
      .map((entry) => entry.label),
    ["App"],
  );
  assert.deepEqual(catalogue.hierarchy.ancestorsById.get("handbook"), ["App"]);
});

test("removed page metadata keeps deleted ancestry and current id precedence", async (context) => {
  const fixture = await createFixture(source());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseline = (await compileCatalogue(config)).manifest;
  const removed = removedManifestEntries(
    { ...baseline, entries: [] },
    baseline,
  );
  assert.deepEqual(removed[0]?.entry.navPath, ["App", "Book"]);
  const catalogue = createCatalogue({ ...baseline, entries: [] }, removed);
  const entry = removed[0]!.entry;
  const html = viewPage(entry, catalogue, {
    ...publicShellContext(catalogue, {
      base: "main",
      updateVersion: 1,
      changedIds: [entry.id],
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
        changedIds: [entry.id],
      }),
    ),
    /data-removed-page=""[^>]*hidden/,
  );
  await fs.promises.writeFile(fixture.entryPath, source("book", "New"));
  const current = (await compileCatalogue(config)).manifest;
  const moved = removedManifestEntries(current, baseline);
  assert.equal(moved.length, 0);
  assert.equal(
    createCatalogue(current, moved).byId.get("handbook")?.title,
    "New",
  );
  assert.equal(removedManifestEntries(baseline, baseline).length, 0);
});

test("nested page ids derive URLs independently of folder labels", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const nested = (
    title: string,
  ) => `import { defineRoot, folder, page } from "@mokly/mokly";
export const mockups = defineRoot({ navPath: ["App"], dependencies: ["notes.md"], relatedDocs: ["notes.md"], address: "ignored", children: [folder({title: ${JSON.stringify(title)}, children: [page({id: "handbook", title: "Handbook", description: "Notes", render: () => "<html><body>Guide</body></html>"})]})]});`;
  for (const title of ["Book", "Renamed", "Moved"]) {
    await fs.promises.writeFile(fixture.entryPath, nested(title));
    const entry = (await compileCatalogue(config)).manifest.entries.find(
      (value) => value.kind === "page",
    );
    assert.equal(
      entry?.kind === "page" ? entryRoute("page", entry.id) : undefined,
      "pages/handbook.html",
    );
    assert.deepEqual(entry?.navPath, ["App", title]);
    assert.deepEqual(entry?.relatedDocs, ["notes.md"]);
    assert.equal("address" in entry!, false);
  }
});
