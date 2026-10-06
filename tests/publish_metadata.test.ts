import assert from "node:assert/strict";
import test from "node:test";

import { isCancellation } from "../dist/errors.js";
import { validateUploadManifest } from "../dist/publish/manifest.js";
import {
  parseRepository,
  readHeadSha,
  readUploadIdentity,
} from "../dist/publish/metadata.js";
import type { GitCommandRunner } from "../dist/review/git.js";

const head = "a".repeat(40);
const manifest = {
  schemaVersion: 2,
  moklyVersion: "1.2.3-beta.1+build.5",
  repository: { host: "github.com", owner: "sample", name: "catalogue" },
  branch: "feature/screens",
  headSha: head,
  uncommittedChanges: false,
  baseRef: null,
  baseSha: null,
  pullRequest: null,
  configPath: "tools/mokly.config.ts",
  exportedAt: "2026-09-14T12:34:56.789Z",
  comparisonPath: null,
};

test("repository metadata supports overrides, HTTPS, scp and SSH without preserving credentials", () => {
  for (const source of [
    "https://user:password@GitHub.com/sample/catalogue.git",
    "git@github.com:sample/catalogue.git",
    "ssh://git@github.com:2222/sample/catalogue.git",
    "github.com/sample/catalogue",
  ])
    assert.deepEqual(parseRepository(source), manifest.repository);
  assert.deepEqual(
    parseRepository("https://git.example.com/team/subgroup/catalogue.git"),
    {
      host: "git.example.com",
      owner: "team/subgroup",
      name: "catalogue",
    },
  );
  for (const source of [
    "/tmp/catalogue",
    "../catalogue",
    "file:///tmp/repo",
    "https://x.test/owner",
    "git@x.test:../repo.git",
    "https://x.test/owner/repo?token=secret",
  ])
    assert.throws(() => parseRepository(source), /git-failed/);
});

function gitRunner(branch = "work"): GitCommandRunner {
  return {
    run: async (args) => {
      switch (args.join(" ")) {
        case "rev-parse --show-toplevel":
          return "/repo\n";
        case "rev-parse --verify HEAD":
          return `${head}\n`;
        case "symbolic-ref --quiet --short HEAD":
          if (branch === "HEAD") throw new Error("detached");
          return `${branch}\n`;
        case "remote":
          return "origin\nbackup\n";
        case "remote get-url origin":
          return "https://token@github.com/sample/catalogue.git\n";
        default:
          assert.fail(`unexpected Git invocation ${args.join(" ")}`);
      }
    },
  };
}

test("Git identity pins actual HEAD and detects PR metadata only inside Actions", async () => {
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/pull/35/merge",
    GITHUB_HEAD_REF: "feature/new",
    GITHUB_SHA: "b".repeat(40),
  };
  const identity = await readUploadIdentity(gitRunner(), env);
  assert.equal(identity.branch, "feature/new");
  assert.equal(identity.pullRequest, 35);
  assert.equal(identity.headSha, head);
  assert.equal(identity.gitRoot, "/repo");
  assert.equal(
    (await readUploadIdentity(gitRunner(), { ...env, GITHUB_ACTIONS: "false" }))
      .branch,
    "work",
  );
  assert.equal(
    (await readUploadIdentity(gitRunner("HEAD"), {})).branch,
    "HEAD",
  );
  assert.equal(
    (
      await readUploadIdentity(gitRunner("HEAD"), {
        GITHUB_ACTIONS: "true",
        GITHUB_REF_NAME: "main",
        GITHUB_REF_TYPE: "branch",
      })
    ).branch,
    "main",
  );
});

test("repository override requires no remotes, while ambiguous or absent remotes fail", async () => {
  const original = gitRunner();
  const runner: GitCommandRunner = {
    run: async (args) => {
      if (args[0] === "remote") return "backup\nupstream\n";
      return original.run(args);
    },
  };
  assert.deepEqual(
    (await readUploadIdentity(runner, {}, "github.com/sample/catalogue"))
      .repository,
    manifest.repository,
  );
  await assert.rejects(readUploadIdentity(runner, {}), /git-failed/);
});

test("publish identity readers preserve Git cancellation", async () => {
  const abort = new Error("stopped");
  abort.name = "AbortError";
  const runner: GitCommandRunner = {
    run: async () => {
      throw abort;
    },
  };
  for (const read of [
    readHeadSha(runner),
    readUploadIdentity(runner, {}, "github.com/sample/catalogue"),
  ])
    await assert.rejects(read, (error) => {
      assert.equal(error, abort);
      assert.equal(isCancellation(error), true);
      return true;
    });

  const original = gitRunner();
  const branchCancelled: GitCommandRunner = {
    run: async (args) => {
      if (args[0] === "symbolic-ref") throw abort;
      return original.run(args);
    },
  };
  await assert.rejects(
    readUploadIdentity(branchCancelled, {}, "github.com/sample/catalogue"),
    (error) => error === abort,
  );

  const failed: GitCommandRunner = {
    run: async () => {
      throw new Error("ordinary failure");
    },
  };
  await assert.rejects(readHeadSha(failed), /git-failed/u);
  await assert.rejects(
    readUploadIdentity(failed, {}, "github.com/sample/catalogue"),
    /git-failed/u,
  );
});

test("manifest validates exact fields, paired comparison metadata, versions, sizes and paths", () => {
  assert.deepEqual(validateUploadManifest(manifest), manifest);
  const comparisonPath = `__mokly/diffs/__generations/${"b".repeat(64)}/review.json`;
  validateUploadManifest({
    ...manifest,
    baseRef: "origin/main",
    baseSha: head,
    comparisonPath,
  });
  for (const invalid of [
    { ...manifest, schemaVersion: 1 },
    { ...manifest, uncommittedChanges: "false" },
    { ...manifest, extra: true },
    { ...manifest, moklyVersion: "1.2" },
    { ...manifest, headSha: "a".repeat(41) },
    { ...manifest, branch: "" },
    { ...manifest, branch: "a\nb" },
    { ...manifest, branch: "é".repeat(128) },
    { ...manifest, pullRequest: 0 },
    { ...manifest, pullRequest: Number.MAX_SAFE_INTEGER + 1 },
    { ...manifest, configPath: "../secret" },
    { ...manifest, configPath: "C:\\secret" },
    { ...manifest, exportedAt: "2026-02-30T12:34:56.789Z" },
    { ...manifest, baseSha: head },
    { ...manifest, comparisonPath },
    { ...manifest, repository: { ...manifest.repository, host: "Github.com" } },
  ])
    assert.throws(
      () => validateUploadManifest(invalid),
      /upload-(invalid-bundle|unsupported-version)/,
    );
});
