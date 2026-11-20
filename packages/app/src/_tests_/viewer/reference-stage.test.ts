import assert from "node:assert/strict";
import { test } from "node:test";

import { referenceStage } from "../../viewer/reference-stage";

import { attempt, branchRow, pullRow, summary } from "./build-fixtures";

/** Both plans: one that lets the project publish and one that refuses. */
const plans = [true, false] as const;

/** The card a reference shows when it names nothing but the plan's choice. */
const plainCard = { kind: "card", closed: undefined, fork: false } as const;

test("a queued or running build comes first for every plan", () => {
  for (const publishingAllowed of plans)
    for (const state of ["queued", "running"] as const) {
      const newestBuild = summary({ state });
      const expected = { kind: "build", buildId: newestBuild.id };
      assert.deepEqual(
        referenceStage(
          branchRow("topic", {
            newestBuild,
            newestPublication: attempt({ state: "failed" }),
          }),
          publishingAllowed,
        ),
        expected,
      );
      // A build already running when its pull request closed can still
      // publish it, so it shows ahead of the closed card.
      for (const closing of ["closed", "merged"] as const)
        assert.deepEqual(
          referenceStage(
            pullRow({ state: closing, newestBuild }),
            publishingAllowed,
          ),
          expected,
        );
    }
});

test("a closed or merged pull request is named for every plan", () => {
  const failedBuild = summary({
    state: "failed",
    createdAt: "2026-09-15T15:00:00Z",
  });
  for (const publishingAllowed of plans)
    for (const state of ["closed", "merged"] as const) {
      // Its failed build and failed publication give way: it gets no new
      // build, so neither is a way on.
      assert.deepEqual(
        referenceStage(
          pullRow({
            state,
            newestBuild: failedBuild,
            newestPublication: attempt({
              state: "failed",
              publishedAt: "2026-09-15T14:00:00Z",
            }),
          }),
          publishingAllowed,
        ),
        { kind: "card", closed: state, fork: false },
      );
      // A closed pull request from a fork is named by how it closed first.
      assert.deepEqual(
        referenceStage(pullRow({ state, fork: true }), publishingAllowed),
        { kind: "card", closed: state, fork: true },
      );
    }
});

test("an open pull request from a fork is named for every plan", () => {
  for (const publishingAllowed of plans)
    assert.deepEqual(
      referenceStage(
        pullRow({
          fork: true,
          newestPublication: attempt({ state: "failed" }),
        }),
        publishingAllowed,
      ),
      { kind: "card", closed: undefined, fork: true },
    );
});

test("while the plan refuses publishing, its card stands for the rest", () => {
  const failedBuild = summary({ state: "failed" });
  for (const row of [
    branchRow("topic", { newestBuild: failedBuild }),
    branchRow("topic", { newestPublication: attempt({ state: "failed" }) }),
    pullRow({ newestBuild: failedBuild }),
    pullRow(),
  ])
    assert.deepEqual(referenceStage(row, false), plainCard);
});

test("a failed build shows only when it is newer than the newest attempt", () => {
  const failed = summary({
    state: "failed",
    createdAt: "2026-09-15T15:00:00Z",
  });
  const row = (publishedAt: string, state: "ready" | "failed") =>
    branchRow("topic", {
      newestBuild: failed,
      newestPublication: attempt({ state, publishedAt }),
    });
  assert.deepEqual(referenceStage(row("2026-09-15T14:00:00Z", "ready"), true), {
    kind: "build",
    buildId: failed.id,
  });
  assert.deepEqual(
    referenceStage(branchRow("topic", { newestBuild: failed }), true),
    { kind: "build", buildId: failed.id },
  );
  assert.deepEqual(
    referenceStage(row("2026-09-15T16:00:00Z", "failed"), true),
    { kind: "failed-publication", publicationId: attempt().id },
  );
});

test("a superseded, cancelled or published build does not hold the stage", () => {
  for (const state of ["superseded", "cancelled", "published"] as const) {
    assert.deepEqual(
      referenceStage(
        branchRow("topic", { newestBuild: summary({ state }) }),
        true,
      ),
      plainCard,
    );
    assert.equal(
      referenceStage(
        branchRow("topic", {
          newestBuild: summary({ state }),
          newestPublication: attempt({ state: "failed" }),
        }),
        true,
      ).kind,
      "failed-publication",
    );
  }
  assert.deepEqual(
    referenceStage(
      branchRow("topic", {
        newestPublication: attempt({ state: "uploading" }),
      }),
      true,
    ),
    plainCard,
  );
});

test("a reference with no row is offered the cards its project offers", () => {
  for (const publishingAllowed of plans)
    assert.deepEqual(referenceStage(undefined, publishingAllowed), plainCard);
});
