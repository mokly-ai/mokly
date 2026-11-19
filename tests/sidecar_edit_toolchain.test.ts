import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { editSource } from "./helpers/sidecar_edit.js";

test("an uncaptured compile without toolchain identity gets no live-only marker", async (context) => {
  const { params } = await editSource(context);
  const manifest = path.resolve("packages/mokly/package.json");
  const open = fs.open;
  context.mock.method(fs, "open", (...args: Parameters<typeof fs.open>) => {
    if (args[0] === manifest)
      return Promise.reject(
        Object.assign(new Error("missing toolchain manifest"), {
          code: "ENOENT",
        }),
      );
    return open(...args);
  });
  const edit = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(edit.result.compiled.toolchain, "");
  assert.deepEqual(edit.result.compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
  });
  assert.equal(await reuse([edit.generation], params, "serveEdit"), undefined);
});
