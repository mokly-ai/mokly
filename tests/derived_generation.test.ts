import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { BaselineError } from "../dist/baseline/errors.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { ConfiguredGitCommandRunner } from "../dist/config/git.js";
import { GitRepositoryEvidence } from "../dist/review/git_evidence.js";
import { RepositoryCatalogueChangeClassifier } from "../dist/server/component_changes.js";
import { BackgroundBaseline } from "../dist/server/demand/baseline.js";
import { BackgroundGeneration } from "../dist/server/demand/generation.js";

import { GatedBaselineBuilder } from "./helpers/baseline_builders.js";
import { derivedFixture } from "./helpers/derived_fixture.js";

test(
  "content generations share a baseline build until the merge base changes",
  { timeout: 30000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const runtime = await prepareLiveRuntime(fixture.config);
    const builder = new GatedBaselineBuilder();
    const commits: (string | null)[] = [];
    let classified = 0;
    const background = new BackgroundGeneration(
      { check() {}, async write() {} },
      new RepositoryCatalogueChangeClassifier(),
      () => {},
      (snapshot) => {
        if (snapshot) classified++;
      },
      {
        builder,
        baselinePrepared: (prepared) => commits.push(prepared?.commit ?? null),
      },
    );
    t.after(() => background.close());
    background.start(runtime, "origin/main", fixture.baseline);
    await waitFor(() => builder.builds.length === 1);
    await background.invalidate();
    assert.equal(builder.builds[0]!.signal?.aborted, false);
    assert.deepEqual([...commits], []);
    background.start(runtime, "origin/main", fixture.baseline);
    builder.releaseAll();
    await waitFor(() => classified === 1);
    assert.equal(builder.builds.length, 1);
    assert.deepEqual([...commits], [fixture.commit]);

    await fixture.git(
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "test: head moves only",
    );
    await background.invalidate();
    background.start(runtime, "origin/main", fixture.baseline);
    await waitFor(() => classified === 2);
    assert.equal(
      builder.builds.length,
      1,
      "unchanged merge base must reuse preparation",
    );

    await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
    await background.invalidate();
    background.start(runtime, "origin/main", fixture.baseline);
    await waitFor(() => classified === 3);
    assert.equal(builder.builds.length, 2);
    assert.equal(builder.builds[0]!.signal?.aborted, true);
    assert.ok(
      commits.includes(null),
      "a moved baseline revokes the previous reader",
    );
    await background.close();
    assert.equal(builder.builds[1]!.signal?.aborted, true);
  },
);

async function waitFor(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (ready()) return;
    await setTimeout(25);
  }
  assert.fail("Background generation did not settle");
}

test("failed preparation can retry and missing history revokes a retained reader", async (t) => {
  const fixture = await derivedFixture(t);
  const builder = new GatedBaselineBuilder();
  builder.releaseAll();
  let failed = false;
  const revoked: null[] = [];
  const baseline = new BackgroundBaseline(
    undefined,
    (commit) => revoked.push(commit),
    {
      async build(request) {
        if (!failed) {
          failed = true;
          throw new BaselineError(
            "baseline-command-failed",
            "temporary install failure",
          );
        }
        return builder.build(request);
      },
    },
  );
  t.after(() => baseline.close());
  const signal = new AbortController().signal;
  await assert.rejects(
    () => baseline.prepare(fixture.config, "origin/main", signal),
    { code: "baseline-command-failed" },
  );
  assert.equal(
    (await baseline.prepare(fixture.config, "origin/main", signal)).commit,
    fixture.commit,
  );
  await fixture.git("update-ref", "-d", "refs/remotes/origin/main");
  await assert.rejects(
    () => baseline.prepare(fixture.config, "origin/main", signal),
    { code: "baseline-history-unavailable" },
  );
  assert.deepEqual(revoked, [null]);
});

test("shutdown cannot start a replacement while draining the retained build", async (t) => {
  const fixture = await derivedFixture(t);
  const runtime = await prepareLiveRuntime(fixture.config);
  const resolution = deferred();
  const drain = deferred();
  const aborted = deferred();
  let resolutions = 0;
  let builds = 0;
  t.mock.method(
    ConfiguredGitCommandRunner.prototype,
    "requireTopLevel",
    async () => fixture.root,
  );
  t.mock.method(GitRepositoryEvidence.prototype, "mergeBase", async () => {
    resolutions++;
    if (resolutions > 1) await resolution.promise;
    return fixture.commit;
  });
  const background = new BackgroundGeneration(
    { check() {}, async write() {} },
    new RepositoryCatalogueChangeClassifier(),
    () => {},
    () => {},
    {
      builder: {
        async build(request) {
          builds++;
          request.signal?.addEventListener("abort", () => aborted.resolve(), {
            once: true,
          });
          await drain.promise;
          throw new BaselineError("baseline-interrupted", "Stopped build");
        },
      },
    },
  );
  t.after(async () => {
    resolution.resolve();
    drain.resolve();
    await background.close();
  });
  background.start(runtime, "origin/main", fixture.baseline);
  await waitFor(() => builds === 1);
  await background.invalidate();
  background.start(runtime, "origin/main", fixture.baseline);
  await waitFor(() => resolutions === 2);
  const closing = background.close();
  await aborted.promise;
  resolution.resolve();
  await setTimeout(0);
  drain.resolve();
  await closing;
  assert.equal(builds, 1, "shutdown must prevent a replacement preparation");
});

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
