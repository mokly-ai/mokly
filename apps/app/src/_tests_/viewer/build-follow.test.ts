import assert from "node:assert/strict";
import { test } from "node:test";

import type { Build } from "../../api/types";
import { followBuild } from "../../viewer/build-follow";
import type { BuildFollower } from "../../viewer/build-follow";
import type { BuildWatch } from "../../viewer/build-watch";
import { build, buildId, logWindow } from "./build-fixtures";

/** One build read a test answers when it chooses. */
interface HeldRead {
  answer: (build: Build) => void;
}

/**
 * Follow one build whose reads a test answers one at a time, in the order the
 * card started them, and record every state the card was shown.
 */
function follow(id: string): {
  follower: BuildFollower;
  held: HeldRead[];
  shown: BuildWatch[];
} {
  const held: HeldRead[] = [];
  const shown: BuildWatch[] = [];
  const follower = followBuild({
    projectId: "project",
    buildId: id,
    reads: {
      getBuild: () =>
        new Promise<Build>((resolve) => held.push({ answer: resolve })),
      listBuildLog: async () => logWindow([]),
    },
    show: (watch) => shown.push(watch),
    visible: () => true,
  });
  return { follower, held, shown };
}

/** The state of the build the card shows last, if it shows one. */
function lastState(shown: readonly BuildWatch[]): string | undefined {
  const last = shown[shown.length - 1];
  return last?.status === "ready" ? last.build.state : last?.status;
}

/** Answer the read a test started last, then let the card take it. */
async function answer(
  read: HeldRead | undefined,
  build: Build,
  settled: Promise<void>,
): Promise<void> {
  assert.ok(read, "the card started no read to answer");
  read.answer(build);
  await settled;
}

test("a read that started before Cancel's answer is dropped when it answers later", async () => {
  const id = buildId(800);
  const running = build({ id, state: "running" });
  const cancelled = build({ id, state: "cancelled", canCancel: false });
  const { follower, held, shown } = follow(id);
  await answer(held[0], running, follower.firstRead);
  assert.equal(lastState(shown), "running");

  // A poll starts reading the build, and Cancel answers before it does.
  const late = follower.poll();
  assert.equal(held.length, 2);
  follower.apply(cancelled);
  assert.equal(lastState(shown), "cancelled");
  await answer(held[1], running, late);
  assert.equal(lastState(shown), "cancelled");

  // The next read started after Cancel's answer, so the card takes it.
  const next = follower.poll();
  await answer(
    held[2],
    { ...cancelled, finishedAt: "2026-09-15T16:31:00Z" },
    next,
  );
  const last = shown[shown.length - 1];
  assert.ok(last?.status === "ready");
  assert.equal(last.build.finishedAt, "2026-09-15T16:31:00Z");
});

test("a read that started after a write's answer moves the card on", async () => {
  // Cancel can answer with the build unchanged: a running build whose upload
  // already committed cannot be cancelled, and goes on to publish.
  const id = buildId(801);
  const running = build({ id, state: "running", canCancel: false });
  const { follower, held, shown } = follow(id);
  await answer(held[0], build({ id, state: "running" }), follower.firstRead);
  follower.apply(running);
  const next = follower.poll();
  await answer(
    held[1],
    build({ id, state: "published", publicationId: "publication" }),
    next,
  );
  assert.equal(lastState(shown), "published");
});

test("a finished build never returns to queued or running", async () => {
  const id = buildId(802);
  const failed = build({
    id,
    state: "failed",
    canCancel: false,
    failure: { step: "install", cause: "exit", exitCode: 1 },
  });
  for (const state of ["queued", "running"] as const) {
    const { follower, held, shown } = follow(id);
    await answer(held[0], failed, follower.firstRead);
    const poll = follower.poll();
    await answer(held[1], build({ id, state }), poll);
    assert.equal(lastState(shown), "failed", state + " after failed");
    follower.apply(build({ id, state }));
    assert.equal(lastState(shown), "failed", "a write answer " + state);
  }
});

test("running to queued is an infrastructure retry, and is shown", async () => {
  const id = buildId(803);
  const { follower, held, shown } = follow(id);
  await answer(held[0], build({ id, state: "running" }), follower.firstRead);
  const poll = follower.poll();
  await answer(held[1], build({ id, state: "queued", step: null }), poll);
  assert.equal(lastState(shown), "queued");
});

test("a write's answer for another build, or after the card stopped, changes nothing", async () => {
  const id = buildId(804);
  const { follower, held, shown } = follow(id);
  await answer(held[0], build({ id, state: "running" }), follower.firstRead);
  // A request's new build is followed afresh, on its own route.
  follower.apply(build({ id: buildId(805), state: "cancelled" }));
  assert.equal(lastState(shown), "running");
  const count = shown.length;
  const poll = follower.poll();
  follower.stop();
  follower.apply(build({ id, state: "cancelled" }));
  await answer(held[1], build({ id, state: "published" }), poll);
  assert.equal(shown.length, count);
});

test("only one read runs at a time, and nothing is polled before the first read", async () => {
  const id = buildId(806);
  const { follower, held } = follow(id);
  void follower.poll();
  assert.equal(held.length, 1, "no poll before the first read found a build");
  await answer(held[0], build({ id, state: "running" }), follower.firstRead);
  const first = follower.poll();
  void follower.poll();
  assert.equal(held.length, 2, "a poll waits for the read before it");
  await answer(held[1], build({ id, state: "running" }), first);
});
