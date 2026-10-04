import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { graphSourceLocation } from "../dist/build/source_inventory.js";
import { LiveSourceLocations } from "../dist/interactive/source_locations.js";

import { installedLinkedFixture } from "./helpers/installed_linked.js";

for (const layout of [
  "logical",
  "dot segments",
  "file symlink",
  "directory symlink",
  "logical symlinked root",
  "physical symlinked root",
  "pnpm",
  "outside root",
  "dangling symlink",
] as const) {
  test(`cached Live ownership matches Node graph ownership with ${layout}`, async (t) => {
    const fixture = await installedLinkedFixture();
    t.after(() => fixture.remove());
    let root = fixture.root;
    let candidate = path.join(root, "node_modules/linked-package/index.ts");
    if (layout === "dot segments") {
      candidate = `${root}/node_modules/linked-package/../linked-package/index.ts`;
    } else if (layout === "file symlink") {
      candidate = path.join(fixture.installed, "linked.js");
      await fs.promises.symlink(
        path.join(fixture.linked, "index.ts"),
        candidate,
      );
    } else if (layout === "directory symlink") {
      await fs.promises.symlink(
        fixture.linked,
        path.join(fixture.installed, "shared"),
      );
      candidate = path.join(fixture.installed, "shared/index.ts");
    } else if (layout.includes("symlinked root")) {
      root = `${fixture.root}-alias`;
      await fs.promises.symlink(fixture.root, root);
      t.after(() => fs.promises.rm(root));
      if (layout === "logical symlinked root")
        candidate = path.join(root, "node_modules/linked-package/index.ts");
    } else if (layout === "pnpm") {
      const dependencies = path.join(
        root,
        "node_modules/.pnpm/outer@1/node_modules",
      );
      await fs.promises.mkdir(dependencies, { recursive: true });
      await fs.promises.symlink(
        fixture.linked,
        path.join(dependencies, "linked-package"),
      );
      candidate = path.join(dependencies, "linked-package/index.ts");
    } else if (layout === "outside root") {
      const outside = `${root}-outside`;
      await fs.promises.mkdir(outside);
      t.after(() => fs.promises.rm(outside, { recursive: true, force: true }));
      const file = path.join(outside, "source.ts");
      await fs.promises.writeFile(file, "export default 1;");
      candidate = path.join(fixture.installed, "outside.js");
      await fs.promises.symlink(file, candidate);
    } else if (layout === "dangling symlink") {
      candidate = path.join(fixture.installed, "missing.js");
      await fs.promises.symlink(
        path.join(fixture.linked, "missing.ts"),
        candidate,
      );
    }
    const locations = new LiveSourceLocations(root);
    for (const file of [
      candidate,
      path.join(root, "node_modules/outer-package/index.js"),
      fixture.entryPath,
    ]) {
      assert.deepEqual(locations.get(file), graphSourceLocation(file, root));
      assert.deepEqual(locations.get(file), graphSourceLocation(file, root));
    }
  });
}

test("installed ownership needs no per-module realpath or directory read", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  for (let index = 0; index < 64; index++)
    await fs.promises.writeFile(
      path.join(fixture.installed, `file-${index}.js`),
      "export default 1;",
    );
  const locations = new LiveSourceLocations(fixture.root);
  const regular = t.mock.method(fs, "realpathSync");
  const native = t.mock.method(fs.realpathSync, "native");
  const reads = t.mock.method(fs, "readdirSync");
  assert.equal(
    locations.get(path.join(fixture.installed, "file-0.js")),
    undefined,
  );
  const firstReads = reads.mock.callCount();
  assert.ok(firstReads > 0);
  for (let index = 1; index < 64; index++)
    assert.equal(
      locations.get(path.join(fixture.installed, `file-${index}.js`)),
      undefined,
    );
  assert.equal(reads.mock.callCount(), firstReads);
  assert.equal(regular.mock.callCount() + native.mock.callCount(), 0);
});

test("a file absent from cached directory entries uses full ownership", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const locations = new LiveSourceLocations(fixture.root);
  assert.equal(
    locations.get(path.join(fixture.installed, "index.js")),
    undefined,
  );
  const candidate = path.join(fixture.installed, "new-linked.js");
  await fs.promises.symlink(path.join(fixture.linked, "index.ts"), candidate);
  const full = graphSourceLocation(candidate, fixture.root);
  assert.ok(full);
  assert.deepEqual(locations.get(candidate), full);
});

test("Mokly runtime aliases and consumer React peers keep the Node ownership exclusion", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const runtime = path.resolve("dist/index.js");
  const alias = path.join(fixture.entriesDir, "runtime.js");
  await fs.promises.symlink(runtime, alias);
  const locations = new LiveSourceLocations(fixture.root);
  for (const file of [
    alias,
    runtime,
    path.resolve("node_modules/react/index.js"),
  ]) {
    assert.equal(graphSourceLocation(file, fixture.root), undefined);
    assert.equal(locations.get(file), undefined);
  }
  const repository = path.resolve(".");
  const repositoryLocations = new LiveSourceLocations(repository);
  for (const file of [
    alias,
    runtime,
    path.resolve("node_modules/react/index.js"),
  ]) {
    assert.equal(graphSourceLocation(file, repository), undefined);
    assert.equal(repositoryLocations.get(file), undefined);
  }
});
