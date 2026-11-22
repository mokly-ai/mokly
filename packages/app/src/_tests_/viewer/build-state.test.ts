import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSteps } from "../../viewer/build-copy";
import {
  buildReference,
  buildReferenceLabel,
  buildSlot,
  failedAfter,
  referenceRowState,
  stepProgress,
} from "../../viewer/build-state";
import type { BuildStepId } from "../../viewer/build-state";

import { attempt, build, buildPullRequest, summary } from "./build-fixtures";

/** The three steps' progress, in order, for one build. */
function steps(over: Parameters<typeof build>[0]): string[] {
  const subject = build(over);
  return buildSteps.map((step) =>
    stepProgress(subject, step.id as BuildStepId),
  );
}

test("the steps before the build's step are done and that step runs", () => {
  assert.deepEqual(steps({ state: "running", step: "install" }), [
    "done",
    "running",
    "waiting",
  ]);
  assert.deepEqual(steps({ state: "running", step: "checkout" }), [
    "running",
    "waiting",
    "waiting",
  ]);
});

test("a queued build waits and a published build is done", () => {
  assert.deepEqual(steps({ state: "queued", step: null }), [
    "waiting",
    "waiting",
    "waiting",
  ]);
  // A build waiting for its next attempt runs nothing yet.
  assert.deepEqual(steps({ state: "queued", step: "install" }), [
    "waiting",
    "waiting",
    "waiting",
  ]);
  assert.deepEqual(steps({ state: "published", step: "publish" }), [
    "done",
    "done",
    "done",
  ]);
});

test("the step a build ended in failed or stopped, and later steps did not run", () => {
  assert.deepEqual(steps({ state: "failed", step: "install" }), [
    "done",
    "failed",
    "idle",
  ]);
  assert.deepEqual(steps({ state: "timed-out", step: "publish" }), [
    "done",
    "done",
    "failed",
  ]);
  assert.deepEqual(steps({ state: "superseded", step: "install" }), [
    "done",
    "stopped",
    "idle",
  ]);
  assert.deepEqual(steps({ state: "cancelled", step: "checkout" }), [
    "stopped",
    "idle",
    "idle",
  ]);
  // A build refused at its claim ran nothing at all.
  assert.deepEqual(steps({ state: "failed", step: null }), [
    "idle",
    "idle",
    "idle",
  ]);
});

test("a build names its branch, or its pull request with number and title", () => {
  assert.deepEqual(buildReference(build()), { kind: "branch", name: "topic" });
  assert.equal(buildReferenceLabel(build()), "topic");
  const pull = build({ pullRequest: buildPullRequest });
  assert.deepEqual(buildReference(pull), { kind: "pull-request", number: 14 });
  assert.equal(buildReferenceLabel(pull), "#14 Host the catalogue");
});

test("the slot says the build's state as the pill says a publication's", () => {
  assert.deepEqual(buildSlot(build({ state: "queued" })), {
    state: "publishing",
    detail: "Publishing now",
  });
  assert.equal(buildSlot(build({ state: "running" })).detail, "Publishing now");
  assert.deepEqual(buildSlot(build({ state: "timed-out" })), {
    state: "failed",
    detail: "Unable to publish",
  });
  assert.deepEqual(buildSlot(build({ state: "superseded" })), {
    state: "none",
    detail: "Not published",
  });
  assert.equal(
    buildSlot(build({ state: "cancelled" })).detail,
    "Not published",
  );
  const published = buildSlot(
    build({ state: "published", finishedAt: "2026-09-15T14:20:00Z" }),
  );
  assert.equal(published.state, "ready");
  assert.match(published.detail, /^Ready · /);
});

test("a failed build is newer than the newest attempt only when it began later", () => {
  const failed = summary({
    state: "failed",
    createdAt: "2026-09-15T15:00:00Z",
  });
  assert.equal(
    failedAfter(failed, attempt({ publishedAt: "2026-09-15T14:00:00Z" })),
    true,
  );
  assert.equal(failedAfter(failed, null), true);
  assert.equal(
    failedAfter(failed, attempt({ publishedAt: "2026-09-15T16:00:00Z" })),
    false,
  );
  assert.equal(failedAfter(summary({ state: "timed-out" }), null), true);
  for (const state of ["queued", "running", "published", "cancelled"] as const)
    assert.equal(failedAfter(summary({ state }), null), false);
  assert.equal(failedAfter(null, null), false);
});

test("a switcher row reads the newer of its publication and its build", () => {
  const running = summary();
  assert.deepEqual(referenceRowState(attempt(), running), {
    state: "publishing",
    headSha: running.headSha,
    fromBuild: true,
  });
  const failed = summary({
    state: "timed-out",
    createdAt: "2026-09-15T15:00:00Z",
  });
  assert.equal(referenceRowState(attempt(), failed).state, "failed");
  assert.equal(referenceRowState(attempt(), failed).headSha, failed.headSha);
  const older = summary({ state: "failed", createdAt: "2026-09-14T15:00:00Z" });
  const ready = referenceRowState(attempt(), older);
  assert.equal(ready.state, "ready");
  assert.equal(ready.headSha, attempt().headSha);
  assert.equal(ready.fromBuild, false);
  assert.equal(
    referenceRowState(null, summary({ state: "cancelled" })).state,
    "none",
  );
  assert.equal(referenceRowState(null, null).headSha, null);
});
