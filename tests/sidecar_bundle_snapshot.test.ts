import assert from "node:assert/strict";
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
