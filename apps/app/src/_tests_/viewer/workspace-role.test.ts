import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import { askAnOwnerToUpgrade } from "../../api/labels";
import type { Workspace, Project } from "../../api/types";
import type { Resource } from "../../data/use-resource";
import { buildAction } from "../../viewer/build-action";
import { buildLine } from "../../viewer/build-copy";
import {
  planRefusalFailure,
  unpublishedStage,
} from "../../viewer/stage-view-decision";
import { workspaceRole } from "../../viewer/workspace-role";

import { build } from "./build-fixtures";

const workspace: Workspace = {
  id: "workspace",
  name: "Workspace",
  slug: "workspace",
  role: "owner",
  plan: "free",
  githubInstallationState: "connected",
  version: 1,
};

function failed(reason: string): ApiError {
  return new ApiError({
    code: reason === "not-found" ? "not-found" : "unavailable",
    reason,
    message: "Refused.",
    requestId: "request-" + reason,
    status: reason === "not-found" ? 404 : 503,
  });
}

const unavailable = failed("unavailable");

/** One workspace read in each state the rule distinguishes. */
const reads = {
  pending: { status: "loading" },
  owner: { status: "ready", value: workspace },
  admin: { status: "ready", value: { ...workspace, role: "admin" } },
  member: { status: "ready", value: { ...workspace, role: "member" } },
  reviewer: { status: "ready", value: { ...workspace, role: "reviewer" } },
  "not-found": { status: "error", error: failed("not-found") },
  unavailable: { status: "error", error: unavailable },
} as const satisfies Record<string, Resource<Workspace>>;

const refused: Project = {
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
  buildsAvailable: true,
  canRequestBuilds: true,
  version: 1,
};

/** A build the plan stopped before any step ran. */
const planRefused = build({
  state: "failed",
  step: null,
  canCancel: false,
  failure: { step: null, cause: "plan-required", exitCode: null },
});

test("one rule reads the workspace role from every read", () => {
  assert.deepEqual(workspaceRole(reads.pending), { kind: "pending" });
  assert.deepEqual(workspaceRole(reads.owner), { kind: "owner" });
  for (const read of [reads.admin, reads.member, reads.reviewer])
    assert.deepEqual(workspaceRole(read), { kind: "not-owner" });
  // `not-found` says the reader cannot see the workspace, which an owner
  // always can; any other failure says nothing about who they are.
  assert.deepEqual(workspaceRole(reads["not-found"]), {
    kind: "not-owner",
  });
  assert.deepEqual(workspaceRole(reads.unavailable), {
    kind: "unreadable",
    error: unavailable,
  });
});

test("the empty stage chooses its plan card by the rule", () => {
  const card = (read: Resource<Workspace>) =>
    unpublishedStage(refused, read, false);
  assert.deepEqual(card(reads.pending), { kind: "pending-workspace" });
  assert.deepEqual(card(reads.owner), {
    kind: "plan-required",
    canUpgrade: true,
  });
  for (const read of [reads.member, reads["not-found"]])
    assert.deepEqual(card(read), { kind: "plan-required", canUpgrade: false });
  assert.deepEqual(card(reads.unavailable), {
    kind: "unreadable-workspace",
    error: unavailable,
  });
});

test("a build's plan refusal chooses its card by the same rule", () => {
  const role = (read: Resource<Workspace>) => workspaceRole(read);
  // While the read runs, the card offers nothing owner-specific.
  assert.equal(
    buildAction(planRefused, refused, role(reads.pending)),
    undefined,
  );
  assert.equal(buildLine(planRefused, role(reads.pending)), undefined);
  assert.equal(planRefusalFailure(planRefused, role(reads.pending)), undefined);
  // An owner opens Billing and is told nothing else.
  assert.deepEqual(buildAction(planRefused, refused, role(reads.owner)), {
    kind: "open-billing",
  });
  assert.equal(buildLine(planRefused, role(reads.owner)), undefined);
  // Everyone else, including a reader the workspace cannot be read for,
  // is asked to find an owner.
  for (const read of [reads.member, reads["not-found"]]) {
    assert.equal(buildAction(planRefused, refused, role(read)), undefined);
    assert.equal(buildLine(planRefused, role(read))?.text, askAnOwnerToUpgrade);
    assert.equal(planRefusalFailure(planRefused, role(read)), undefined);
  }
  // A failed read gives way to the workspace's own Try again, and is never
  // told to ask an owner.
  const unreadable = role(reads.unavailable);
  assert.equal(planRefusalFailure(planRefused, unreadable), unavailable);
  assert.equal(buildLine(planRefused, unreadable), undefined);
  assert.equal(buildAction(planRefused, refused, unreadable), undefined);
});

test("an unreadable workspace leaves every other build card alone", () => {
  const unreadable = workspaceRole(reads.unavailable);
  for (const shown of [
    build(),
    build({
      state: "failed",
      canCancel: false,
      failure: { step: "install", cause: "exit", exitCode: 1 },
    }),
    undefined,
  ])
    assert.equal(planRefusalFailure(shown, unreadable), undefined);
});
