import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { serializeManifest } from "../dist/registry/manifest.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { baselineResourceConfig } from "../dist/review/base_manifest.js";
import { decideReferencedResource } from "../dist/review/deleted_resource.js";
import type { BaselineReader, GitFile } from "../dist/review/git.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

for (const side of ["base", "head"] as const) {
  test(`${side} inventory distinguishes absent counterparts from invalid listed files`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    const manifest = {
      ...compilation.manifest,
      assetClosure: ["listed.pdf"],
      sourceFiles: [...compilation.manifest.sourceFiles, "mockups/private.css"],
    };
    const outputs = new Map(compilation.outputs);
    outputs.set("mokly-manifest.json", serializeManifest(manifest));
    const calls: string[] = [];
    let response: GitFile = { kind: "missing" };
    const git: BaselineReader = {
      fileExists: async () => false,
      fileKind: async () => "missing",
      readFile: async () => "",
      readFileBytes: async () => Buffer.alloc(0),
      readFiles: async (_commit, paths) => {
        calls.push(...paths);
        return new Map(paths.map((file) => [file, response]));
      },
    };
    const reader =
      side === "base"
        ? new GitReviewAssetReader(
            baselineResourceConfig(config, manifest),
            git,
            "commit",
            "mockups",
            manifest,
          )
        : new CompiledReviewAssetReader(config, outputs);
    for (const route of [
      "mokly-generated/new/index.html",
      "mokly-generated/styles/new.css",
      "mokly-generated/assets/new.png",
      "new.html",
      "private.css",
    ]) {
      assert.equal(await reader.readIfExists(route), undefined, route);
    }
    assert.deepEqual(calls, []);
    for (const route of [
      "../escape",
      "mokly-generated/../escape",
      "mokly-generated/mokly-manifest.json",
    ])
      await assert.rejects(reader.readIfExists(route), {
        code: "review-invalid",
      });
    await assert.rejects(reader.readIfExists("listed.pdf"), {
      code: "review-invalid",
    });
    await assert.rejects(reader.read("new.html"), { code: "review-invalid" });
    if (side === "head") {
      await fs.writeFile(
        path.join(fixture.mockupsDir, "unlisted.html"),
        "stray",
      );
      assert.equal(await reader.readIfExists("unlisted.html"), undefined);
      await fs.symlink(
        "../notes.md",
        path.join(fixture.mockupsDir, "listed.pdf"),
      );
    } else response = { kind: "symlink" };
    await assert.rejects(reader.readIfExists("listed.pdf"), {
      code: "review-invalid",
    });
  });
}

test("the target inventory rule rejects a deleted listed head resource", async (t) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<img src="../../deleted.svg" alt="Deleted" />',
    }),
  );
  t.after(() => removeFixture(fixture));
  const resource = path.join(fixture.mockupsDir, "deleted.svg");
  await fs.writeFile(resource, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.deepEqual(compilation.manifest.assetClosure, ["deleted.svg"]);
  const bytes = await fs.readFile(resource);
  await fs.unlink(resource);
  const reader = new CompiledReviewAssetReader(config, compilation.outputs);
  await assert.rejects(reader.readIfExists("deleted.svg"), {
    code: "review-invalid",
  });
  const deleted = await decideReferencedResource(
    "deleted.svg",
    { readIfExists: async () => bytes },
    reader,
  );
  assert.deepEqual(deleted, {
    before: bytes,
    byteChanged: true,
    kind: "verified-deletion",
  });
  await assert.rejects(
    decideReferencedResource(
      "deleted.svg",
      { readIfExists: async () => undefined },
      reader,
    ),
    {
      code: "review-invalid",
      message:
        "[mokly/review-invalid] referenced resource is missing: deleted.svg",
    },
  );
});
