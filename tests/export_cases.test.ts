import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateExportReferences } from "../dist/export/references.js";
import { exportCatalogue } from "../dist/export/run.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

test("a clean HEAD matching origin/main exports only unmodified screens", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const head = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
  const main = (
    await fixture.git("rev-parse", "refs/remotes/origin/main")
  ).stdout.trim();
  assert.equal(head, main);
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.ok(result.comparisonUrl);
  const review = JSON.parse(
    await fs.promises.readFile(
      path.join(fixture.output, result.comparisonUrl),
      "utf8",
    ),
  ) as ReviewResult;
  assert.ok(review.screens.length > 0);
  assert.ok(review.screens.every((screen) => screen.state === "unchanged"));
  const home = await fs.promises.readFile(
    path.join(fixture.output, "view/screens/home.html"),
    "utf8",
  );
  assert.match(home, /Unmodified/);
  assert.match(home, /class="mbk-diff-toolbar" hidden=""/);
});

test("an empty registry retains normal build validation and the previous site", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const previous = await fs.promises.readFile(
    path.join(fixture.output, "index.html"),
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    "export const mockups = [];\n",
  );
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site" }),
    /empty-registry/,
  );
  assert.deepEqual(
    await fs.promises.readFile(path.join(fixture.output, "index.html")),
    previous,
  );
});

test("ignored-only and shared-impact evidence does not fill exported Changes", async (context) => {
  const source = (value: string) =>
    validEntrySource({
      body: `<ReviewIgnore id="counter"><span>${value}</span></ReviewIgnore>`,
    }).replace("defineCollection,", "ReviewIgnore, defineCollection,");
  const fixture = await createExportFixture(source("before"));
  context.after(() => fixture.close());
  await fs.promises.writeFile(fixture.entryPath, source("after"));
  await fs.promises.writeFile(
    path.join(fixture.root, "notes.md"),
    "Changed shared guidance\n",
  );
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.ok(result.comparisonUrl);
  const review = JSON.parse(
    await fs.promises.readFile(
      path.join(fixture.output, result.comparisonUrl),
      "utf8",
    ),
  ) as ReviewResult;
  assert.equal(
    review.screens.find((screen) => screen.id === "home")?.state,
    "ignored-only",
  );
  assert.equal(
    review.screens.find((screen) => screen.id === "details")?.state,
    "unchanged",
  );
  assert.deepEqual(review.sharedImpact, ["notes.md"]);
  const html = await fs.promises.readFile(
    path.join(fixture.output, "index.html"),
    "utf8",
  );
  assert.doesNotMatch(html, /data-changed="true"/);
});

test("renamed screens keep both routes but only the current id alias", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const source = await fs.promises.readFile(fixture.entryPath, "utf8");
  await fs.promises.writeFile(
    fixture.entryPath,
    source.replace(
      'route: "screens/home.html"',
      'route: "screens/renamed.html"',
    ),
  );
  const result = await exportCatalogue(fixture.config, { outDir: "site" });
  assert.equal(result.idRoutes["home"], "/view/screens/renamed.html");
  assert.match(
    await fs.promises.readFile(
      path.join(fixture.output, "view/screens/home.html"),
      "utf8",
    ),
    /This screen was removed/,
  );
  const alias = await fs.promises.readFile(
    path.join(fixture.output, "id/home/index.html"),
    "utf8",
  );
  assert.doesNotMatch(alias, /This screen was removed/);
  assert.match(alias, /screens\/renamed.html/);
});

test("missing baseline documents and absent history fail before installing output", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fixture.git("rm", "mockups/screens/home.mobile.html");
  await fixture.git("commit", "-qm", "test: missing baseline document");
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site", base: "HEAD" }),
    /not a regular Git file \(missing\)/,
  );
  assert.equal(fs.existsSync(fixture.output), false);
  await fixture.git("checkout", "--orphan", "unrelated");
  await fixture.git("commit", "-qm", "test: unrelated history");
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site" }),
    /merge base/,
  );
  assert.equal(fs.existsSync(fixture.output), false);
});

test("provider aliases cannot weaken generic resource validation", () => {
  const files = new Map([
    ["index.html", '<a href="/view/home">Home</a>'],
    ["view/home.html", "Home"],
  ]);
  assert.throws(() => validateExportReferences(files), /unavailable/);
  validateExportReferences(files, new Map([["view/home", "view/home.html"]]));
  for (const aliases of [
    new Map([["view/home", "missing.html"]]),
    new Map([["../escape", "view/home.html"]]),
  ])
    assert.throws(
      () => validateExportReferences(files, aliases),
      /Invalid hosting alias/,
    );
  assert.throws(
    () =>
      validateExportReferences(
        files,
        new Map([["index.html", "view/home.html"]]),
      ),
    /Export path collision/,
  );
});
