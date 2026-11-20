import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import { unpublishedStage } from "../../viewer/stage-view-decision";

import { project, building, owner, branch, pull } from "./stage-view-fixtures";

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
