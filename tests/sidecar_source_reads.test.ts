import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";
import type { OnLoadArgs, PluginBuild } from "esbuild";

import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import { consumerRequire } from "../packages/mokly/src/sidecar/paths.js";
import type { BundleInputs } from "../packages/mokly/src/sidecar/plugins.js";
import { consumerPlugins } from "../packages/mokly/src/sidecar/plugins.js";

import { bundleParams } from "./helpers/sidecar.js";

test("source loads use parallel callback reads and reuse the recorded bytes", async (context) => {
  const params = bundleParams();
  params.moduleResolution.loaders[".raw"] = "binary";
  const inputs: BundleInputs = {
    files: new Map<string, Uint8Array>(),
    cssModules: new Set<string>(),
    virtualOrigins: new Map(),
  };
  const paths = await ModulePaths.create(params);
  const require = await consumerRequire(params, paths);
  const plugin = consumerPlugins(params, inputs, require, paths).find(
    (plugin) => plugin.name === "mokly-consumer",
  )!;
  let load: Parameters<PluginBuild["onLoad"]>[1] | undefined;
  await build({
    stdin: { contents: "" },
    write: false,
    plugins: [
      {
        name: "registered-source-load",
        setup(builder) {
          return plugin.setup({
            ...builder,
            onLoad(options, callback) {
              if (options.namespace === "file") load = callback;
              builder.onLoad(options, callback);
            },
          });
        },
      },
    ],
  });
  assert.ok(load);
  const pending: Array<{
    file: string;
    complete(error: NodeJS.ErrnoException | null, bytes?: Buffer): void;
  }> = [];
  const reads = context.mock.method(
    fs,
    "readFile",
    (file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      const callback = args.at(-1);
      assert.ok(typeof callback === "function");
      pending.push({
        file: String(file),
        complete: (error, bytes) => callback(error, bytes),
      });
    },
  );
  const promiseReads = context.mock.method(fs.promises, "readFile", async () =>
    Buffer.from("unexpected promise read"),
  );
  const captures = context.mock.method(Error, "captureStackTrace");
  const args = (name: string): OnLoadArgs => ({
    path: path.join(params.sourceRoot, name),
    namespace: "file",
    suffix: "",
    pluginData: undefined,
    with: {},
  });
  const first = args("first.tsx");
  const second = args("second.raw");
  const loaded = [load(first), load(second)];
  assert.deepEqual(
    pending.map(({ file }) => file),
    [first.path, second.path],
  );
  const bytes = [
    Buffer.from("export const node = <main />;"),
    Buffer.from([0, 255, 10]),
  ];
  pending[1]!.complete(null, bytes[1]);
  pending[0]!.complete(null, bytes[0]);
  assert.deepEqual(await Promise.all(loaded), [
    { contents: bytes[0], loader: "tsx" },
    { contents: bytes[1], loader: "binary" },
  ]);
  assert.deepEqual(await load(first), { contents: bytes[0], loader: "tsx" });
  assert.equal(reads.mock.callCount(), 2);
  assert.equal(promiseReads.mock.callCount(), 0);
  assert.equal(captures.mock.callCount(), 0);
  const failure = Object.assign(new Error("read fault"), { code: "EACCES" });
  const failed = load(args("failed.js"));
  pending[2]!.complete(failure);
  await assert.rejects(Promise.resolve(failed), (error: unknown) => {
    assert.equal(error, failure);
    return true;
  });
  assert.equal(reads.mock.callCount(), 3);
  assert.equal(captures.mock.callCount(), 1);
  assert.equal(captures.mock.calls[0]!.arguments[0], failure);
  assert.equal(promiseReads.mock.callCount(), 0);
});
