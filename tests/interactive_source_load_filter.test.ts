import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { build } from "esbuild";

import { graphSourceLocation } from "../dist/build/source_inventory.js";
import { repositoryLoadFilter } from "../dist/interactive/source_load_filter.js";
import { LiveSourceLocations } from "../dist/interactive/source_locations.js";

import { installedLinkedFixture } from "./helpers/installed_linked.js";

for (const layout of [
  "logical",
  "file symlink",
  "directory symlink",
  "logical symlinked root",
  "physical symlinked root",
  "pnpm",
  "outside and back",
  "linked node_modules root",
] as const) {
  test(`the Go filter includes every repository load with ${layout}`, async (t) => {
    const fixture = await installedLinkedFixture();
    t.after(() => fixture.remove());
    let root = fixture.root;
    let candidate = path.join(root, "node_modules/linked-package/index.ts");
    if (layout === "file symlink") {
      candidate = path.join(fixture.installed, "linked.js");
      await fs.promises.symlink(
        path.join(fixture.linked, "index.ts"),
        candidate,
      );
    } else if (layout === "directory symlink") {
      const nested = path.join(fixture.installed, "nested");
      await fs.promises.mkdir(nested);
      await fs.promises.symlink(fixture.linked, path.join(nested, "shared"));
      candidate = path.join(nested, "shared/index.ts");
    } else if (layout.includes("symlinked root")) {
      root = `${fixture.root}-[a]+(b).`;
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
    } else if (layout === "outside and back") {
      const outside = `${root}-outside`;
      await fs.promises.mkdir(outside);
      t.after(() => fs.promises.rm(outside, { recursive: true, force: true }));
      await fs.promises.symlink(fixture.linked, path.join(outside, "shared"));
      await fs.promises.symlink(
        outside,
        path.join(root, "node_modules/external"),
      );
      candidate = path.join(root, "node_modules/external/shared/index.ts");
    } else if (layout === "linked node_modules root") {
      await fs.promises.rename(
        path.join(root, "node_modules"),
        path.join(root, "package-store"),
      );
      await fs.promises.symlink(
        "package-store",
        path.join(root, "node_modules"),
      );
    }
    const filter = repositoryLoadFilter(root, []);
    const locations = new LiveSourceLocations(root);
    assert.ok(graphSourceLocation(candidate, root));
    for (const file of [
      candidate,
      fixture.entryPath,
      path.join(root, "node_modules/outer-package/index.js"),
    ]) {
      const full = graphSourceLocation(file, root);
      assert.deepEqual(locations.get(file), full);
      if (full) assert.ok(filter.test(file), `filter must include ${file}`);
    }
  });
}

test("the Go filter covers all repository first segments except the installed directory", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const filter = repositoryLoadFilter(fixture.root, []);
  const names = [
    "n",
    "no",
    "nod",
    "node",
    "node_",
    "node_m",
    "node_mo",
    "node_mod",
    "node_modu",
    "node_modul",
    "node_module",
    "node_modules-extra",
    "other",
    ".hidden",
  ];
  for (const name of names) {
    const candidate = path.join(fixture.root, name, "source.ts");
    await fs.promises.mkdir(path.dirname(candidate));
    await fs.promises.writeFile(candidate, "export default 1;");
    assert.ok(graphSourceLocation(candidate, fixture.root));
    assert.ok(filter.test(candidate));
  }
  const installed = path.join(fixture.installed, "index.js");
  assert.equal(graphSourceLocation(installed, fixture.root), undefined);
  assert.equal(filter.test(installed), false);
  assert.ok(
    repositoryLoadFilter(fixture.root, [
      "node_modules/outer-package/index.js",
    ]).test(installed),
  );
  assert.ok(
    repositoryLoadFilter(path.parse(fixture.root).root, []).test(
      fixture.entryPath,
    ),
  );
});

test("a failed installed-directory scan keeps that subtree eligible and falls back to full ownership", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const candidate = path.join(fixture.installed, "linked.js");
  await fs.promises.symlink(path.join(fixture.linked, "index.ts"), candidate);
  const readdir = fs.readdirSync;
  t.mock.method(
    fs,
    "readdirSync",
    (...arguments_: Parameters<typeof fs.readdirSync>) => {
      if (arguments_[0] === fixture.installed)
        throw new Error("directory listing refused");
      return Reflect.apply(readdir, fs, arguments_) as ReturnType<
        typeof fs.readdirSync
      >;
    },
  );
  const full = graphSourceLocation(candidate, fixture.root);
  assert.ok(full);
  assert.ok(repositoryLoadFilter(fixture.root, []).test(candidate));
  assert.deepEqual(new LiveSourceLocations(fixture.root).get(candidate), full);
});

test("esbuild applies the filter in Go before invoking a file-load callback", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const calls: string[] = [];
  const filter = repositoryLoadFilter(fixture.root, []);
  await build({
    absWorkingDir: fixture.root,
    bundle: true,
    entryPoints: [path.join(fixture.installed, "index.js")],
    logLevel: "silent",
    preserveSymlinks: true,
    plugins: [
      {
        name: "count-filtered-loads",
        setup(pluginBuild) {
          pluginBuild.onLoad({ filter, namespace: "file" }, ({ path }) => {
            calls.push(path);
            return undefined;
          });
        },
      },
    ],
    write: false,
  });
  assert.ok(!calls.includes(path.join(fixture.installed, "index.js")));
  assert.ok(
    calls.includes(
      path.join(fixture.root, "node_modules/linked-package/index.ts"),
    ),
  );
});
