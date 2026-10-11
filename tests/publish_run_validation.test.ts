import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import { isCancellation, MoklyError } from "../dist/errors.js";
import { assertCommittedGeneration } from "../dist/publish/generated.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { createManifest } from "../dist/registry/manifest.js";

import {
  config,
  dependencies,
  options,
} from "./helpers/publish_run_fixture.js";

const compilationMetadata: Omit<Compilation, "outputs"> = {
  diagnostics: [],
  deliveredStyleSources: [],
  manifest: {
    ...createManifest([], [], ["light"]),
    assetClosure: [],
    blobHashAlgorithm: "sha1",
    generatedFiles: [],
  },
};

test("a moved HEAD or failed export prevents the HTTP side effect", async () => {
  const moved = dependencies();
  const git = moved.boundaries.git;
  let reads = 0;
  moved.boundaries.git = {
    run: async (args) => {
      if (args.includes("--verify") && ++reads > 1) return "e".repeat(40);
      return git.run(args);
    },
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, moved.boundaries),
    /git-failed.*HEAD changed/,
  );
  assert.equal(moved.uploaded(), false);
  const failed = dependencies();
  failed.boundaries.export = async () => {
    throw new Error("export failed");
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, failed.boundaries),
    /export failed/,
  );
  assert.equal(failed.uploaded(), false);
});

test("an identity failure after cancellation is classified before export", async () => {
  const fixture = dependencies();
  const controller = new AbortController();
  let exported = false;
  fixture.boundaries.git = {
    run: async () => {
      controller.abort();
      throw new MoklyError("git-failed", "identity reader failed");
    },
  };
  fixture.boundaries.export = async () => {
    exported = true;
    throw new Error("export must not start");
  };
  await assert.rejects(
    publishCatalogue(
      config,
      options,
      "1.2.3",
      {},
      fixture.boundaries,
      controller.signal,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "git-failed");
      assert.equal(
        error.message,
        "[mokly/git-failed] Publish needs a committed Git checkout and a valid remote; use --repository <host>/<owner>/<name> to set repository identity.",
      );
      assert.equal(isCancellation(error), true);
      assert.equal(error.cause, undefined);
      assert.match(error.stack ?? "", /readUploadIdentity/u);
      return true;
    },
  );
  assert.equal(exported, false);
});

test("invalid metadata prevents capture and upload", async () => {
  const fixture = dependencies();
  await assert.rejects(
    publishCatalogue(
      { ...config, configPath: "/outside/secret" },
      options,
      "1.2.3",
      {},
      fixture.boundaries,
    ),
    /upload-invalid-bundle/,
  );
  assert.equal(fixture.uploaded(), false);
});

test("publish classifies generation comparison failure after cancellation before capture", async () => {
  const fixture = dependencies();
  const controller = new AbortController();
  const git = fixture.boundaries.git;
  fixture.boundaries.git = {
    run: async (args) => {
      if (args[0] === "ls-files")
        return "tools/mockups/mokly-generated/index.html\0";
      if (args[0] === "ls-tree") {
        controller.abort();
        throw new MoklyError("git-failed", "generation reader failed");
      }
      return git.run(args);
    },
  };
  fixture.boundaries.export = async (_config, selected) => {
    await selected.onCompilation?.({
      ...compilationMetadata,
      outputs: new Map([["index.html", "Generated"]]),
    });
    assert.fail("export capture must not start");
  };
  fixture.boundaries.fetch = async () =>
    assert.fail("receiver must not be contacted");
  await assert.rejects(
    publishCatalogue(
      config,
      options,
      "1.2.3",
      {},
      fixture.boundaries,
      controller.signal,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "git-failed");
      assert.equal(isCancellation(error), true);
      assert.match(error.detail, /generation reader failed/);
      return true;
    },
  );
  assert.equal(fixture.uploaded(), false);
});

test("committed generation comparison accepts binary files above the historical batch limit", async () => {
  const bytes = Buffer.alloc(48 * 1024 * 1024 + 1, 0xff);
  const objectId = execFileSync("git", ["hash-object", "--stdin"], {
    input: bytes,
    encoding: "utf8",
  }).trim();
  const prefix = "tools/mockups/mokly-generated";
  const name = `${prefix}/large.bin`;
  await assertCommittedGeneration(
    {
      run: async (args) => {
        assert.equal(args[0], "ls-tree");
        return args.includes("-zl")
          ? `100644 blob ${objectId} ${bytes.length}\t${name}\0`
          : `100644 blob ${objectId}\t${name}\0`;
      },
      runBytesWithInput: async () =>
        assert.fail("comparison must not read historical blobs"),
    },
    "a".repeat(40),
    {
      prefixes: [prefix],
      tracked: [name],
      ignoreRules: [],
    },
    { ...compilationMetadata, outputs: new Map([["large.bin", bytes]]) },
  );
});
