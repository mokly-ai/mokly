import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { installedSourceImporter } from "../dist/build/interactive_source_paths.js";
import type { InteractiveSourceResolution } from "../dist/build/interactive_source_resolution.js";
import { RecordedInstalledImporters } from "../dist/interactive/installed_importers.js";

import { installedStylesFixture } from "./helpers/installed_styles.js";

test("an empty installed record skips all importer path and realpath work", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const lookup = new RecordedInstalledImporters(fixture.root, []);
  const regular = t.mock.method(fs, "realpathSync");
  const native = t.mock.method(fs.realpathSync, "native");
  for (const candidate of [
    path.join(fixture.directory, "index.js"),
    path.join(fixture.entriesDir, "fixture.mockup.tsx"),
    "/outside/node_modules/package/index.js",
    "",
  ])
    assert.equal(lookup.get(candidate), undefined);
  assert.equal(regular.mock.callCount() + native.mock.callCount(), 0);
});

for (const layout of [
  "logical",
  "importer symlink",
  "logical symlinked root",
  "physical symlinked root",
  "outside root",
  "unrecorded logical",
] as const) {
  test(`cheap installed lookup agrees with full lookup for ${layout}`, async (t) => {
    const fixture = await installedStylesFixture();
    t.after(() => fixture.remove());
    let root = fixture.root;
    let importer = path.join(fixture.directory, "index.js");
    let recordedPath = "node_modules/installed-style/index.js";
    if (layout === "importer symlink") {
      importer = path.join(fixture.directory, "alias.js");
      await fs.promises.symlink("index.js", importer);
      recordedPath = "node_modules/installed-style/alias.js";
    } else if (
      layout === "logical symlinked root" ||
      layout === "physical symlinked root"
    ) {
      root = `${fixture.root}-alias`;
      await fs.promises.symlink(fixture.root, root);
      t.after(() => fs.promises.rm(root));
      if (layout === "logical symlinked root")
        importer = path.join(root, recordedPath);
    } else if (layout === "outside root") {
      const outside = `${fixture.root}-outside`;
      importer = path.join(outside, "node_modules/installed-style/index.js");
      await fs.promises.mkdir(path.dirname(importer), { recursive: true });
      await fs.promises.writeFile(importer, "export default {};");
      t.after(() => fs.promises.rm(outside, { recursive: true, force: true }));
    } else if (layout === "unrecorded logical") {
      importer = path.join(fixture.directory, "browser.js");
      await fs.promises.writeFile(importer, "export default {};");
    }
    const full = installedSourceImporter(importer, root);
    const expected =
      full?.type === "installed" && full.path === recordedPath
        ? full
        : undefined;
    const lookup = new RecordedInstalledImporters(root, [
      resolution(recordedPath),
    ]);
    const regular = t.mock.method(fs, "realpathSync");
    const native = t.mock.method(fs.realpathSync, "native");
    assert.deepEqual(lookup.get(importer), expected);
    const firstCalls = regular.mock.callCount() + native.mock.callCount();
    if (layout === "unrecorded logical") assert.equal(firstCalls, 0);
    else
      assert.ok(
        firstCalls > 0,
        "a possible match or outside path needs full validation",
      );
    assert.deepEqual(lookup.get(importer), expected);
    assert.equal(
      regular.mock.callCount() + native.mock.callCount(),
      firstCalls,
      "positive and negative identities are cached",
    );
  });
}

test("a matching cheap key cannot replay an importer whose physical target is repository code", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const importer = path.join(fixture.directory, "index.js");
  await fs.promises.rm(importer);
  await fs.promises.symlink(fixture.entryPath, importer);
  const lookup = new RecordedInstalledImporters(fixture.root, [
    resolution("node_modules/installed-style/index.js"),
  ]);
  assert.equal(installedSourceImporter(importer, fixture.root), undefined);
  assert.equal(lookup.get(importer), undefined);
});

function resolution(importer: string): InteractiveSourceResolution {
  return {
    attributes: [],
    importer: { type: "installed", path: importer },
    kind: "import-statement",
    specifier: "installed-style/card.module.css",
    target: "node_modules/installed-style/card.module.css",
  };
}
