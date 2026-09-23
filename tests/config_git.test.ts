import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { loadConfig } from "../dist/config/load.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import {
  baselineReaderForCommit,
  readOnlyRepositoryForCommit,
} from "../dist/review/repository.js";
import { RepositoryComponentChanges } from "../dist/server/component_changes.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";
import { nestedRepository } from "./helpers/nested_repository.js";

test("configured Git validates once before concurrent text, byte and batch reads", async () => {
  const calls: string[] = [];
  let validated: (root: string) => void = () => {};
  const validation = new Promise<string>((resolve) => {
    validated = resolve;
  });
  const input = Buffer.from("input");
  const bytes = Buffer.from([0, 255]);
  const runner = new ConfiguredGitCommandRunner(
    { repoRoot: repositoryRoot },
    undefined,
    {
      async run(args) {
        calls.push(args[0]!);
        return args[0] === "rev-parse" ? validation : "text";
      },
      async runBytes() {
        calls.push("bytes");
        return bytes;
      },
      async runBytesWithInput(_args, received) {
        assert.equal(received, input);
        calls.push("batch");
        return bytes;
      },
    },
  );
  assert.deepEqual(calls, []);
  const pending = [
    runner.run(["text"]),
    runner.runBytes(["bytes"]),
    runner.runBytesWithInput!(["batch"], input),
  ];
  assert.deepEqual(calls, ["rev-parse"]);
  validated(repositoryRoot);
  assert.deepEqual(await Promise.all(pending), ["text", bytes, bytes]);
  await runner.run(["again"]);
  assert.equal(calls.filter((call) => call === "rev-parse").length, 1);
});

test("Git root validation accepts a physical alias and retries unavailable history", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const alias = path.join(fixture.root, "alias");
  await fs.symlink(repositoryRoot, alias);
  let attempts = 0;
  const runner = new ConfiguredGitCommandRunner(
    { repoRoot: alias },
    undefined,
    {
      async run(args) {
        if (args[0] !== "rev-parse") return "ready";
        if (++attempts === 1) throw new Error("no history");
        return repositoryRoot;
      },
    },
  );
  await assert.rejects(() => runner.run(["read"]), /no history/);
  assert.equal(await runner.run(["read"]), "ready");
  assert.equal(runner.runBytesWithInput, undefined);
  assert.equal(
    Buffer.from(await runner.runBytes(["read"])).toString(),
    "ready",
  );
});

test("nested roots fail before preparation, pinned reads, classification or tracking", async (t) => {
  const { config, compilation } = await nestedRepository(t);
  const expected = { code: "config-invalid" };
  const commit = "a".repeat(40);
  await assert.rejects(
    () =>
      prepareReviewRepository(config, "HEAD", {
        commit,
        builder: {
          async build() {
            assert.fail("must reject before building");
          },
        },
      }),
    expected,
  );
  const pinned = readOnlyRepositoryForCommit(config, commit, "blobs");
  await assert.rejects(() => pinned.evidence.changedPaths(commit), expected);
  const reader = baselineReaderForCommit(config, commit, "blobs");
  await assert.rejects(
    () => reader.readFile(commit, "mockups/mokly-manifest.json"),
    expected,
  );
  await assert.rejects(
    () => reader.readFiles!(commit, ["mockups/mokly-manifest.json"]),
    expected,
  );
  await assert.rejects(
    () =>
      new GitReviewAssetReader(config, reader, commit, "mockups").read(
        "screens/home.mobile.html",
      ),
    expected,
  );
  await assert.rejects(
    () =>
      new RepositoryComponentChanges(
        config,
        compilation.manifest,
        "HEAD",
      ).baseline(),
    expected,
  );
  await assert.rejects(
    async () => new FileSystemGeneratedOutputStore().check(compilation, config),
    expected,
  );
});

test("build and untracked check work outside a Git repository", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-no-git-"));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.cp(fixture.root, root, { recursive: true });
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
  );
  const config = await loadConfig(root);
  await assert.rejects(
    () => new ConfiguredGitCommandRunner(config).requireTopLevel(),
    /not a git repository/i,
  );
  const store = new FileSystemGeneratedOutputStore();
  const compilation = await compileCatalogue(config);
  await store.write(compilation, config);
  assert.equal(await store.check(compilation, config), "untracked");
});
