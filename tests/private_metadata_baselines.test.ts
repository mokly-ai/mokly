import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseManifest } from "../dist/registry/manifest.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import {
  CommittedRepository,
  NodeGitCommandRunner,
} from "../dist/review/git.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { FORMER_MANIFEST_NAME } from "./private_metadata_fixture.js";

test("an earlier manifest name is only an incompatibility sentinel", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const {
    assetClosure: _closure,
    blobHashAlgorithm: _algorithm,
    generatedFiles: _files,
    ...legacy
  } = compilation.manifest;
  const formerManifest = {
    ...legacy,
    schemaVersion: 5,
    generatedBy: "mokabook",
  };
  assert.throws(
    () => parseManifest(formerManifest),
    /expected Mokly manifest schema version 8/,
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, FORMER_MANIFEST_NAME),
    JSON.stringify(formerManifest),
  );
  const runner = new NodeGitCommandRunner(fixture.root);
  await runner.run(["init", "-q"]);
  await runner.run(["add", "."]);
  await runner.run([
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "test: former Mokabook metadata",
  ]);
  const git = new CommittedRepository(runner);
  await assert.rejects(
    readBaseManifest(git.reader, "HEAD", config),
    (error: unknown) =>
      (error as { code?: string }).code === "baseline-incompatible-earlier",
  );
  const reader = new GitReviewAssetReader(
    config,
    git.reader,
    "HEAD",
    "mockups",
  );
  await assert.rejects(
    reader.read(FORMER_MANIFEST_NAME),
    /targets internal catalogue metadata/,
  );
});
