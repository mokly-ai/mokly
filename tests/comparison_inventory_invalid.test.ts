import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import type { GeneratedFile } from "../dist/build/generated_file.js";
import { loadConfig } from "../dist/config/load.js";
import { serializeManifest } from "../dist/registry/manifest.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { decideReferencedResource } from "../dist/review/deleted_resource.js";
import type { BaselineReader, GitFile } from "../dist/review/git.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const state of [
  "symlink",
  "other",
  "missing",
  "unreadable",
  "invalid-bytes",
] as const) {
  test(`listed base data stays invalid when ${state}`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    const manifest = {
      ...compilation.manifest,
      assetClosure: ["resource.bin"],
    };
    const reader: BaselineReader = {
      fileExists: async () => true,
      fileKind: async () => "regular",
      readFile: async () => "",
      readFileBytes: async () => Buffer.alloc(0),
      readFiles: async (_commit, paths) => {
        if (state === "unreadable")
          throw Object.assign(new Error("cannot read"), { code: "EACCES" });
        const file =
          state === "invalid-bytes"
            ? { kind: "regular", bytes: undefined }
            : { kind: state };
        return new Map(paths.map((filePath) => [filePath, file as GitFile]));
      },
    };
    const assets = new GitReviewAssetReader(
      config,
      reader,
      "base",
      "mockups",
      manifest,
    );
    await assert.rejects(assets.readIfExists("resource.bin"), {
      code: "review-invalid",
    });
  });
}

test("listed head generated data with an invalid byte value never becomes absence", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const outputs = new Map(compilation.outputs);
  outputs.set("home/index.mobile.html", 42 as unknown as GeneratedFile);
  const assets = new CompiledReviewAssetReader(config, outputs);
  await assert.rejects(
    assets.readIfExists("mokly-generated/home/index.mobile.html"),
    { code: "review-invalid" },
  );
});

for (const state of [
  "symlink",
  "directory",
  "protected",
  "unreadable",
] as const) {
  test(`verified deletion cannot admit a ${state} listed head file`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    const route =
      state === "protected" ? "private.source.html" : "resource.bin";
    const target = path.join(fixture.mockupsDir, route);
    if (state === "symlink") await fs.symlink("../notes.md", target);
    else if (state === "directory") await fs.mkdir(target);
    else await fs.writeFile(target, "private");
    if (state === "unreadable") {
      const read = fs.readFile.bind(fs);
      t.mock.method(fs, "readFile", (...args: Parameters<typeof read>) => {
        if (String(args[0]) === target)
          return Promise.reject(
            Object.assign(new Error("cannot read"), { code: "EACCES" }),
          );
        return read(...args);
      });
    }
    const outputs = new Map(compilation.outputs);
    outputs.set(
      "mokly-manifest.json",
      serializeManifest({ ...compilation.manifest, assetClosure: [route] }),
    );
    const assets = new CompiledReviewAssetReader(config, outputs);
    await assert.rejects(
      decideReferencedResource(
        route,
        { readIfExists: async () => Buffer.from("base") },
        assets,
      ),
      { code: "review-invalid" },
    );
  });
}
