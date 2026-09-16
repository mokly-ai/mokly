import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { HistoricalManifest } from "../dist/registry/types.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { baselineResourceConfig } from "../dist/review/base_manifest.js";
import type { BaselineReader } from "../dist/review/git.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { excludedNames, permittedNames } from "./helpers/public_exclusions.js";

const reader: BaselineReader = {
  fileExists: async () => true,
  fileKind: async () => "regular",
  readFile: async () => "baseline",
  readFileBytes: async () => Buffer.from("baseline"),
};

for (const schema of ["v2", "v3", "component-v4", "page-v4", "v5"]) {
  test(`historical ${schema} resources use active exclusions relative to the baseline root`, async (t) => {
    const fixture = await createFixture(undefined, {
      extraConfig: 'publicExclude: ["INTERNAL/**"],',
    });
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const manifest = {
      schemaVersion: Number(schema.slice(-1)),
      entries: [],
      legacyPages: [],
      ...(schema === "page-v4" || schema === "v5"
        ? { sourceFiles: ["old-output/source.json"] }
        : {}),
    } as unknown as HistoricalManifest;
    const historical = new GitReviewAssetReader(
      baselineResourceConfig(config, manifest),
      reader,
      "baseline",
      "old-output",
    );
    for (const name of [
      ...excludedNames,
      "mokly-manifest.json",
      "unused.source.html",
    ])
      await assert.rejects(
        historical.read(name),
        /not a public static file/,
        name,
      );
    for (const name of permittedNames)
      assert.equal(
        Buffer.from(await historical.read(name)).toString(),
        "baseline",
        name,
      );
    if ("sourceFiles" in manifest)
      await assert.rejects(
        historical.read("source.json"),
        /not a public static file/,
      );
  });
}

test("historical regular resources ignore current filesystem aliases but still reject historical symlinks", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "README.md"), "private now");
  await fs.symlink("README.md", path.join(fixture.mockupsDir, "data.json"));
  await fs.symlink("../entries", path.join(fixture.mockupsDir, "old"));
  const config = await loadConfig(fixture.root);
  const historical = new GitReviewAssetReader(
    config,
    reader,
    "baseline",
    "mockups",
  );
  for (const name of ["data.json", "old/page.html"])
    assert.equal(
      Buffer.from(await historical.read(name)).toString(),
      "baseline",
    );
  const symlinks = new GitReviewAssetReader(
    config,
    { ...reader, fileKind: async () => "symlink" },
    "baseline",
    "mockups",
  );
  await assert.rejects(symlinks.read("data.json"), /not a regular Git file/);
});
