import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import type { Project } from "../../api/types";
import { closedState, fromFork } from "../../viewer/resolution";
import { unpublishedStage } from "../../viewer/stage-view-decision";

import { branchRow, pullRow } from "./build-fixtures";

const project: Project = {
  id: "project",
  workspaceId: "workspace",
  workspaceSlug: "workspace",
  name: "Private project",
  slug: "private-project",
  repository: "mokly-ai/private",
  configPath: "mokly.config.json",
  visibility: "private",
  requireApproval: false,
  canAdmin: true,
  publishingAllowed: false,
  automaticBuilds: false,
  buildsAvailable: false,
  canRequestBuilds: false,
  version: 1,
};

test("a private unpublished project waits for its workspace ownership", () => {
  assert.equal(
    unpublishedStage(project, { status: "loading" }, false).kind,
    "pending-workspace",
  );
});

test("a private unpublished project reports an unreadable workspace", () => {
  const error = new ApiError({
    code: "unavailable",
    reason: "unavailable",
    message: "Try again shortly.",
    requestId: "request-1",
    status: 503,
  });
  assert.deepEqual(
    unpublishedStage(project, { status: "error", error }, false),
    {
      kind: "unreadable-workspace",
      error,
    },
  );
});

test("a project-only administrator uses the project publishing capability", () => {
  const error = new ApiError({
    code: "not-found",
    reason: "not-found",
    message: "Not found.",
    requestId: "request-2",
    status: 404,
  });
  assert.deepEqual(
    unpublishedStage(
      { ...project, publishingAllowed: true },
      { status: "error", error },
      false,
    ),
    { kind: "set-up" },
  );
});

test("a project-only administrator without the capability asks an owner", () => {
  const error = new ApiError({
    code: "not-found",
    reason: "not-found",
    message: "Not found.",
    requestId: "request-3",
    status: 404,
  });
  assert.deepEqual(
    unpublishedStage(project, { status: "error", error }, false),
    { kind: "plan-required", canUpgrade: false },
  );
});

const building: Project = {
  ...project,
  publishingAllowed: true,
  buildsAvailable: true,
  canRequestBuilds: true,
};
const owner = {
  status: "ready",
  value: {
    id: "workspace",
    name: "Workspace",
    slug: "workspace",
    role: "owner",
    plan: "team",
    githubInstallationState: "connected",
    version: 1,
  },
} as const;
const branch = { kind: "branch", name: "topic" } as const;
const pull = { kind: "pull-request", number: 4 } as const;

test("a reader who can request a build is offered to publish the reference", () => {
  assert.deepEqual(
    unpublishedStage(building, owner, false, {
      reference: branch,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "publish", reference: branch },
  );
  assert.deepEqual(
    unpublishedStage(building, owner, true, {
      reference: pull,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "publish", reference: pull },
  );
});

test("a reviewer of a project that can build waits for someone who can", () => {
  const reviewer = { ...building, canRequestBuilds: false, canAdmin: false };
  assert.deepEqual(
    unpublishedStage(reviewer, owner, false, {
      reference: branch,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "publish-reader", pullRequest: false },
  );
  assert.deepEqual(
    unpublishedStage(reviewer, owner, true, {
      reference: pull,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "publish-reader", pullRequest: true },
  );
  // Builds are shown to members only; everyone else reads the viewer as before.
  assert.deepEqual(
    unpublishedStage(reviewer, owner, false, {
      reference: branch,
      member: false,
      closed: undefined,
      fork: false,
    }),
    { kind: "set-up" },
  );
});

test("the Team card comes first whenever the plan refuses", () => {
  const refused = { ...building, publishingAllowed: false };
  assert.deepEqual(
    unpublishedStage(refused, owner, false, {
      reference: branch,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "plan-required", canUpgrade: true },
  );
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

test("a project that cannot build, or names no branch, keeps Set up publishing", () => {
  const unable = {
    ...building,
    buildsAvailable: false,
    canRequestBuilds: false,
  };
  assert.deepEqual(
    unpublishedStage(unable, owner, false, {
      reference: branch,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "set-up" },
  );
  assert.deepEqual(
    unpublishedStage(unable, owner, true, {
      reference: pull,
      member: true,
      closed: undefined,
      fork: false,
    }),
    { kind: "pull-request" },
  );
  assert.deepEqual(
    unpublishedStage(building, owner, false, {
      member: true,
      closed: undefined,
      fork: false,
    }),
    {
      kind: "set-up",
    },
  );
});

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
