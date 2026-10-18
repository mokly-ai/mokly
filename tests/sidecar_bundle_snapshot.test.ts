import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { definitionData } from "../packages/mokly/src/authoring/runtime.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { describe } from "../packages/mokly/src/sidecar/describe.js";

import { bundleParams } from "./helpers/sidecar.js";

test("bundling hashes the source snapshot that esbuild compiles", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-bundle-snapshot-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const entry = path.join(root, "entry.mjs");
  const code = (value: string) =>
    `import {definePage} from "@mokly/mokly"; export default definePage({title:"Snapshot",description:"Snapshot",relatedDocs:[],render:()=>${JSON.stringify(value)}});`;
  await fs.writeFile(entry, "export default incomplete =>");
  const original = fs.readFile;
  fs.readFile = ((
    file: Parameters<typeof fs.readFile>[0],
    ...args: unknown[]
  ) =>
    String(file) === entry
      ? Promise.resolve(Buffer.from(code("selected snapshot")))
      : Reflect.apply(original, fs, [file, ...args])) as typeof fs.readFile;
  context.after(() => {
    fs.readFile = original;
  });
  const built = await bundle(
    bundleParams({
      sourceRoot: root,
      entryFiles: ["entry.mjs"],
      renderer: null,
      storiesFiles: [],
    }),
    build,
  );
  fs.readFile = original;
  built.generation.maps = {};
  await describe(built.generation);
  const data = definitionData(
    built.generation.handles.get("entry.mjs#default"),
  );
  assert.equal((data!.input.render as () => string)(), "selected snapshot");
});

for (const fixture of [
  {
    file: "value.txt",
    attribute: "",
    expression: "value",
    bytes: "before",
    rendered: "before",
  },
  {
    file: "value.data",
    attribute: 'with {type:"text"}',
    expression: "value",
    bytes: "before",
    rendered: "before",
  },
  {
    file: "value.data",
    attribute: 'with {type:"json"}',
    expression: "value.message",
    bytes: '{"message":"before"}',
    rendered: "before",
  },
  {
    file: "value.data",
    attribute: 'with {type:"bytes"}',
    expression: "Array.from(value).join(',')",
    bytes: "before",
    rendered: "98,101,102,111,114,101",
  },
]) {
  test(`bundled bytes remain the digest baseline for ${fixture.file} ${fixture.attribute}`, async (context) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-loader-snapshot-"),
    );
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const asset = path.join(root, fixture.file);
    await fs.writeFile(asset, fixture.bytes);
    await fs.writeFile(
      path.join(root, "entry.mjs"),
      `import {definePage} from "@mokly/mokly";
import value from ${JSON.stringify("./" + fixture.file)} ${fixture.attribute};
export default definePage({title:"Snapshot",description:"Snapshot",relatedDocs:[],render:()=>${fixture.expression}});`,
    );
    const built = await bundle(
      bundleParams({
        sourceRoot: root,
        entryFiles: ["entry.mjs"],
        renderer: null,
        storiesFiles: [],
      }),
      async (options) => {
        const compiled = await build(options);
        await fs.writeFile(asset, "after");
        return compiled;
      },
    );
    built.generation.maps = {};
    await describe(built.generation);
    const data = definitionData(
      built.generation.handles.get("entry.mjs#default"),
    );
    assert.equal((data!.input.render as () => string)(), fixture.rendered);
    assert.equal(await fs.readFile(asset, "utf8"), "after");
    assert.equal(
      built.result.modules.find((module) => module.path === fixture.file)
        ?.digest,
      createHash("sha256").update(fixture.bytes).digest("hex"),
    );
  });
}

test("bundling rejects a compiler file whose consumed bytes were not recorded", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-unrecorded-bundle-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "entry.mjs"),
    'export const value = "fixture";',
  );
  await assert.rejects(
    bundle(
      bundleParams({
        sourceRoot: root,
        entryFiles: ["entry.mjs"],
        renderer: null,
        storiesFiles: [],
      }),
      (options) => build({ ...options, plugins: [] }),
    ),
    {
      code: "bundle-failed",
      message: /Bundled source bytes were not recorded: entry\.mjs/u,
    },
  );
});
