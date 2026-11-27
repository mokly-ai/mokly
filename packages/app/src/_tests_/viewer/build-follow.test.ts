import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import type { Build, BuildLogChunk } from "../../api/types";
import { followBuild } from "../../viewer/build-follow";
import type { BuildFollower } from "../../viewer/build-follow";
import type { BuildWatch } from "../../viewer/build-watch";

import { build, buildId, chunk, logWindow } from "./build-fixtures";

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

/** The build the card shows last, or nothing while it shows no build. */
function lastBuild(shown: readonly BuildWatch[]): Build | undefined {
  const last = shown[shown.length - 1];
  return last?.status === "ready" ? last.build : undefined;
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

/** The answer of a read the API refuses. */
const unavailable = new ApiError({
  code: "unavailable",
  reason: "unavailable",
  message: "Unavailable.",
  requestId: "01994f10-0000-7000-8000-0000000000cc",
  status: 503,
});

/** The output one state of the card shows, if it shows the build. */
function output(watch: BuildWatch | undefined): string[] {
  return watch?.status === "ready"
    ? watch.log.chunks.map((held) => held.text)
    : [];
}

/** What the API answers a card, which reads it refuses, and how many ran. */
interface RefusableApi {
  build: Build;
  log: BuildLogChunk[];
  refuse: { build: boolean; log: boolean };
  reads: { build: number; log: number };
}

/**
 * Follow one running build whose reads a test can refuse one by one, count
 * every read the card starts, and record every state the card was shown.
 */
async function followRefusable(id: string): Promise<{
  follower: BuildFollower;
  api: RefusableApi;
  shown: BuildWatch[];
}> {
  const api: RefusableApi = {
    build: build({ id, state: "running" }),
    log: [chunk(1, "installing\n")],
    refuse: { build: false, log: false },
    reads: { build: 0, log: 0 },
  };
  const shown: BuildWatch[] = [];
  const follower = followBuild({
    projectId: "project",
    buildId: id,
    reads: {
      getBuild: async () => {
        api.reads.build += 1;
        if (api.refuse.build) throw unavailable;
        return api.build;
      },
      listBuildLog: async (_project, _build, after) => {
        api.reads.log += 1;
        if (api.refuse.log) throw unavailable;
        const fresh = api.log.filter((held) => held.sequence > after);
        return fresh.length > 0
          ? logWindow(fresh)
          : logWindow([], { nextAfter: after });
      },
    },
    show: (watch) => shown.push(watch),
    visible: () => true,
  });
  await follower.firstRead;
  assert.deepEqual(api.reads, { build: 1, log: 1 }, "the first read");
  return { follower, api, shown };
}

/** A build that failed at install, as the API reads it. */
function failedAtInstall(id: string): Build {
  return build({
    id,
    state: "failed",
    canCancel: false,
    failure: { step: "install", cause: "exit", exitCode: 1 },
  });
}

test("a poll whose reads fail tries each read once and keeps the card and the output as they are", async () => {
  const id = buildId(807);
  const { follower, api, shown } = await followRefusable(id);
  const before = shown.length;
  assert.deepEqual(output(shown[before - 1]), ["installing\n"]);

  // The build fails while both of the poll's reads are refused: nothing on
  // the card changes, and no failure replaces it.
  api.build = failedAtInstall(id);
  api.refuse = { build: true, log: true };
  await follower.poll();
  assert.deepEqual(api.reads, { build: 2, log: 2 });
  assert.equal(shown.length, before);
  assert.equal(lastState(shown), "running");

  // The next read that succeeds moves the card, with the failure's cause,
  // and keeps its output.
  api.refuse = { build: false, log: false };
  await follower.poll();
  assert.equal(lastState(shown), "failed");
  assert.deepEqual(lastBuild(shown), failedAtInstall(id));
  assert.deepEqual(output(shown[shown.length - 1]), ["installing\n"]);
});

test("a poll whose build read fails shows the log's new output and keeps the state", async () => {
  const id = buildId(808);
  const { follower, api, shown } = await followRefusable(id);
  api.build = failedAtInstall(id);
  api.log = [...api.log, chunk(2, "building\n")];
  api.refuse = { build: true, log: false };
  await follower.poll();
  assert.deepEqual(api.reads, { build: 2, log: 2 });
  assert.equal(lastState(shown), "running");
  assert.deepEqual(output(shown[shown.length - 1]), [
    "installing\n",
    "building\n",
  ]);
});

test("a poll whose log read fails moves the state and keeps the output", async () => {
  const id = buildId(809);
  const { follower, api, shown } = await followRefusable(id);
  api.build = failedAtInstall(id);
  api.log = [...api.log, chunk(2, "building\n")];
  api.refuse = { build: false, log: true };
  await follower.poll();
  assert.deepEqual(api.reads, { build: 2, log: 2 });
  assert.equal(lastState(shown), "failed");
  assert.deepEqual(lastBuild(shown), failedAtInstall(id));
  assert.deepEqual(output(shown[shown.length - 1]), ["installing\n"]);
});
