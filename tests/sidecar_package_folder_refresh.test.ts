import assert from "node:assert/strict";
import syncFs from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";

test("marked ordinary roots refresh before folder capture and unseen metadata", async (context) => {
  for (const barrier of ["folder", "metadata"] as const) {
    const root = await nativeRoot(context);
    const one = path.join(root, "actual/one");
    const two = path.join(root, "actual/two");
    const firstRoot = path.join(root, "lookup-one");
    const secondRoot = path.join(root, "lookup-two");
    const firstPackage = path.join(firstRoot, "node_modules/chosen");
    const secondPackage = path.join(secondRoot, "node_modules/chosen");
    const earlier = path.join(root, "node_modules/chosen");
    await write(path.join(root, "package.json"), '{"name":"catalogue"}');
    await write(path.join(root, "tsconfig.json"), "{}");
    await write(
      path.join(root, "entry.mjs"),
      'export {exact} from "chosen/exact"; export {value} from "chosen/sub/value";',
    );
    await write(
      path.join(one, "package.json"),
      JSON.stringify({
        name: "chosen",
        ...(barrier === "folder"
          ? { exports: { "./exact": "./exact.js", "./sub/": "./lib/" } }
          : {}),
      }),
    );
    await write(
      path.join(two, "package.json"),
      JSON.stringify({
        name: "chosen",
        ...(barrier === "metadata" ? { padding: "x".repeat(1_048_576) } : {}),
      }),
    );
    for (const directory of [one, two])
      await write(
        path.join(directory, "exact.js"),
        'export const exact="same-exact";',
      );
    const selected = path.join(two, "sub/value/index.js");
    await write(selected, 'export const value="original-index";');
    await fs.mkdir(path.dirname(firstPackage), { recursive: true });
    await fs.mkdir(path.dirname(secondPackage), { recursive: true });
    await fs.symlink(one, firstPackage, "junction");
    await fs.symlink(two, secondPackage, "junction");
    if (barrier === "folder") {
      const index = path.join(one, "lib/value/index.js");
      await fs.mkdir(path.dirname(index), { recursive: true });
      await fs.symlink(selected, index, "file");
    }
    const params = nativeParams(root);
    params.moduleResolution.packageRoots = [root, firstRoot, secondRoot];
    const trigger =
      barrier === "folder" ? path.join(firstPackage, "exact.js") : firstPackage;
    let changed = false;
    const native = syncFs.realpathSync.native;
    let restore = () => {};
    const compile: typeof build = async (options) => {
      const result = await build(options);
      const probe = context.mock.method(
        syncFs.realpathSync,
        "native",
        (...args: Parameters<typeof native>) => {
          const value = native(...args);
          if (!changed && args[0] === trigger) {
            changed = true;
            syncFs.mkdirSync(path.dirname(earlier), { recursive: true });
            syncFs.symlinkSync(two, earlier, "junction");
          }
          return value;
        },
      );
      restore = () => probe.mock.restore();
      return result;
    };
    const first = await bundle(
      params,
      compile,
      undefined,
      undefined,
      "serveEdit",
    );
    restore();
    assert.equal(changed, true, barrier);
    assert.match(first.result.compiled.code, /original-index/);
    assert.equal(
      first.result.compiled.reuseEvidence.uncaptured,
      "serveEdit",
      barrier,
    );
    assert.deepEqual(
      first.result.compiled.reuseEvidence.inputs,
      {
        [path.join(one, "tsconfig.json")]: { kind: "absent" },
        [path.join(two, "tsconfig.json")]: { kind: "absent" },
      },
      barrier,
    );
    await write(
      path.join(one, barrier === "folder" ? "lib/value.ts" : "sub/value.ts"),
      'export const value="unused-preferred";',
    );
    const fresh = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.match(fresh.result.compiled.code, /original-index/);
    assert.equal(
      (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
      first.result.compiled.runtimeKey,
      barrier,
    );
  }
});

test("a later repeated package name cannot hide the native installed folder owner", async (context) => {
  const fixture = await folderPackage(context, {
    name: "first scalar name",
    route: "installed",
  });
  await write(
    path.join(fixture.root, "package.json"),
    '{"name":"catalogue","name":"chosen","exports":{"./sub/value":"./node_modules/chosen/lib/value/index.js"}}',
  );
  const entry = path.join(fixture.root, "entry.mjs");
  const before = await fs.readFile(entry);
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await fixture.addPreferred();
  const fresh = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(fresh.result.compiled.code, /preferred-file/);
  assert.deepEqual(await fs.readFile(entry), before);
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});
