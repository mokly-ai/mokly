import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { NodeGitCommandRunner } from "../packages/mokly/dist/review/git.js";
import {
  GitReferenceObserver,
  RepositoryGitReferences,
} from "../packages/mokly/dist/server/demand/git_references.js";

import { changedFixture } from "./helpers/changed_fixture.js";

test("reference polling validates once per repository and cancellation session", async (t) => {
  let validations = 0;
  const root = process.cwd();
  t.mock.method(
    NodeGitCommandRunner.prototype,
    "run",
    async (argv: readonly string[]) => {
      if (argv.includes("--show-toplevel")) {
        validations++;
        return root;
      }
      return "a".repeat(40);
    },
  );
  const source = new RepositoryGitReferences();
  const first = new AbortController();
  await source.read(root, "main", first.signal);
  await source.read(root, "main", first.signal);
  assert.equal(validations, 1);
  first.abort();
  await source.read(root, "main", new AbortController().signal);
  assert.equal(validations, 2);
});

test("reference observation detects availability and ref changes without requests", async () => {
  let reference: string | undefined;
  let changes = 0;
  const observer = new GitReferenceObserver(
    { read: async () => reference },
    () => changes++,
    5,
  );
  observer.replace("repo", "main");
  await setImmediate();
  assert.equal(changes, 1);
  reference = "head-a:base-a";
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(changes, 2);
  reference = "head-a:base-b";
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(changes, 3);
  await observer.close();
  reference = "head-b:base-b";
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(changes, 3);
});

test("reference replacement and shutdown discard delayed reads", async () => {
  const reads: { signal: AbortSignal; resolve(value: string): void }[] = [];
  let changes = 0;
  const observer = new GitReferenceObserver(
    {
      read: async (_root, _base, signal) =>
        new Promise<string>((resolve) => reads.push({ signal, resolve })),
    },
    () => changes++,
    5000,
  );
  observer.replace("repo", "old");
  observer.replace("repo", "new");
  assert.equal(reads[0]!.signal.aborted, true);
  reads[1]!.resolve("new");
  await setImmediate();
  reads[0]!.resolve("stale");
  await setImmediate();
  assert.equal(changes, 1);
  observer.replace("repo", "pending");
  await observer.close();
  assert.equal(reads[2]!.signal.aborted, true);
  reads[2]!.resolve("closed");
  await setImmediate();
  assert.equal(changes, 1);
});

test("resolved references support packed refs, worktree HEAD and missing-ref recovery", async (t) => {
  const fixture = await changedFixture(t);
  const refs = new RepositoryGitReferences();
  const signal = new AbortController().signal;
  const head = fixture.git("rev-parse", "HEAD").toString().trim();
  fixture.git("pack-refs", "--all");
  assert.equal(
    await refs.read(fixture.root, "main", signal),
    JSON.stringify([head, head]),
  );
  assert.equal(
    await refs.read(fixture.root, "later", signal),
    JSON.stringify([head, null]),
  );
  fixture.git("branch", "later");
  const worktree = path.join(fixture.root, "linked");
  fixture.git("worktree", "add", "--detach", worktree, "HEAD");
  assert.equal(
    await refs.read(worktree, "later", signal),
    JSON.stringify([head, head]),
  );
});
