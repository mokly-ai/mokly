import assert from "node:assert/strict";
import { test } from "node:test";

import { closedState, fromFork } from "../../viewer/resolution";
import { unpublishedStage } from "../../viewer/stage-view-decision";

import { branchRow, pullRow } from "./build-fixtures";
import { building, owner, pull, branch } from "./stage-view-fixtures";

test("a pull request row says how it closed, and a branch row never does", () => {
  assert.equal(closedState(pullRow({ state: "closed" })), "closed");
  assert.equal(closedState(pullRow({ state: "merged" })), "merged");
  assert.equal(closedState(pullRow()), undefined);
  assert.equal(closedState(branchRow("topic")), undefined);
});

test("a closed or merged pull request names how it closed, for every project and plan", () => {
  // It gets no new build, so a project that can build offers no way to
  // publish it, a reviewer is not told to wait for someone who can, a project
  // that cannot build no longer says publishing starts when its check runs, and
  // a plan that refuses publishing does not stand in for it, even before the
  // workspace read has answered.
  const reviewer = { ...building, canRequestBuilds: false, canAdmin: false };
  const unable = {
    ...building,
    buildsAvailable: false,
    canRequestBuilds: false,
  };
  const refused = { ...building, publishingAllowed: false };
  for (const state of ["closed", "merged"] as const) {
    const closed = closedState(pullRow({ state }));
    for (const each of [building, reviewer, unable, refused])
      for (const workspace of [owner, { status: "loading" } as const])
        for (const member of [true, false])
          for (const fork of [false, true])
            assert.deepEqual(
              unpublishedStage(each, workspace, true, {
                reference: pull,
                member,
                closed,
                fork,
              }),
              { kind: "closed-pull-request", state },
            );
  }
});

test("an open pull request from a fork says so, for every project and plan", () => {
  // No build runs for it: nobody is offered to publish it or told to wait
  // for a member, and the plan's cards do not stand in for it.
  const reviewer = { ...building, canRequestBuilds: false, canAdmin: false };
  const unable = {
    ...building,
    buildsAvailable: false,
    canRequestBuilds: false,
  };
  const refused = { ...building, publishingAllowed: false };
  assert.equal(fromFork(pullRow({ fork: true })), true);
  assert.equal(fromFork(pullRow()), false);
  assert.equal(fromFork(branchRow("topic")), false);
  for (const each of [building, reviewer, unable, refused])
    for (const workspace of [owner, { status: "loading" } as const])
      for (const member of [true, false])
        assert.deepEqual(
          unpublishedStage(each, workspace, true, {
            reference: pull,
            member,
            closed: undefined,
            fork: fromFork(pullRow({ fork: true })),
          }),
          { kind: "fork-pull-request" },
        );
});

test("an open pull request of the bound repository shows the Team card", () => {
  const refused = { ...building, publishingAllowed: false };
  assert.deepEqual(
    unpublishedStage(refused, owner, true, {
      reference: pull,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "plan-required", canUpgrade: true },
  );
});

test("only a pull request closes or comes from a fork", () => {
  // A branch keeps the card its project offers.
  assert.deepEqual(
    unpublishedStage(building, owner, false, {
      reference: branch,
      member: true,
      closed: "closed",
      fork: true,
    }),
    { kind: "publish", reference: branch },
  );
  // The same pull request, open again, is offered to publish.
  assert.deepEqual(
    unpublishedStage(building, owner, true, {
      reference: pull,
      member: true,
      closed: closedState(pullRow()),
      fork: false,
    }),
    { kind: "publish", reference: pull },
  );
});
