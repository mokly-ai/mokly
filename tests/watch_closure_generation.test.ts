import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { MANIFEST_NAME } from "../dist/registry/manifest.js";
import { BackgroundGeneration } from "../dist/server/demand/generation.js";
import { ResourceWatcher } from "../dist/server/resource_watcher.js";

import {
  resourceFixture,
  ResourceWatcherFactory,
} from "./helpers/resource_watcher.js";

for (const refreshOutput of [false, true]) {
  test(`resource refresh keeps the accepted manifest current without writing evidence-only work (refreshOutput=${refreshOutput})`, async (t) => {
    const fixture = await resourceFixture(t);
    const resources = new ResourceWatcher(
      new ResourceWatcherFactory(),
      () => {},
      assert.fail,
    );
    t.after(() => resources.close());
    const writes: Compilation[] = [];
    let accepted: Compilation | undefined;
    let finish: () => void = () => {};
    const completed = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const generation = new BackgroundGeneration(
      {
        check() {},
        async write(compilation) {
          writes.push(compilation);
        },
      },
      {
        async read(_config, manifest) {
          return { baseline: manifest };
        },
      },
      (compilation) => {
        accepted = compilation;
      },
      () => finish(),
      {
        resources,
        writeOutput: true,
        diagnostic: (error) => assert.fail(String(error)),
      },
    );
    t.after(() => generation.close());
    await fs.writeFile(
      path.join(fixture.mockupsDir, "nested.css"),
      'main{background:url("b.svg")}',
    );
    generation.start(
      componentRuntime(fixture.compilation),
      "main",
      fixture.compilation,
      refreshOutput,
    );
    await completed;
    assert.ok(accepted);
    assert.deepEqual(accepted.manifest.assetClosure, [
      "b.svg",
      "home.css",
      "nested.css",
    ]);
    assert.equal(writes.length, refreshOutput ? 1 : 0);
    assert.deepEqual(
      JSON.parse(String(accepted.outputs.get(MANIFEST_NAME))).assetClosure,
      accepted.manifest.assetClosure,
    );
    assert.deepEqual(fixture.compilation.manifest.assetClosure, [
      "a.svg",
      "home.css",
      "nested.css",
    ]);
    for (const [route, content] of fixture.compilation.outputs)
      if (route !== MANIFEST_NAME)
        assert.deepEqual(accepted.outputs.get(route), content, route);
  });
}
