import assert from "node:assert/strict";
import { test } from "node:test";

import type { BuildFailure } from "../../api/types";
import { buildAction } from "../../viewer/build-action";
import type { WorkspaceRole } from "../../viewer/workspace-role";
import { build } from "./build-fixtures";

const owner: WorkspaceRole = { kind: "owner" };
const notOwner: WorkspaceRole = { kind: "not-owner" };
const member = { canRequestBuilds: true };
const reviewer = { canRequestBuilds: false };

/** A build that ended with one failure cause. */
function failed(cause: BuildFailure["cause"]) {
  return build({
    state: cause === "deadline" || cause === "idle" ? "timed-out" : "failed",
    canCancel: false,
    failure: { step: "publish", cause, exitCode: cause === "exit" ? 1 : null },
  });
}

test("a build that works offers Cancel while it can be cancelled", () => {
  for (const state of ["queued", "running"] as const) {
    assert.deepEqual(buildAction(build({ state }), member, notOwner), {
      kind: "cancel",
    });
    assert.equal(
      buildAction(build({ state, canCancel: false }), member, notOwner),
      undefined,
    );
  }
});

test("a published build opens its catalogue, on Changes when it compared", () => {
  const published = build({
    state: "published",
    canCancel: false,
    publicationId: "publication",
  });
  assert.deepEqual(buildAction(published, reviewer, notOwner), {
    kind: "open-catalogue",
    publicationId: "publication",
    changes: true,
  });
  assert.deepEqual(
    buildAction({ ...published, baseRef: null }, reviewer, notOwner),
    { kind: "open-catalogue", publicationId: "publication", changes: false },
  );
  assert.equal(
    buildAction({ ...published, publicationId: null }, member, notOwner),
    undefined,
  );
});

test("a replaced build opens the newer one", () => {
  const superseded = build({
    state: "superseded",
    canCancel: false,
    supersededBy: "newer",
  });
  assert.deepEqual(buildAction(superseded, reviewer, notOwner), {
    kind: "open-newer",
    buildId: "newer",
  });
  assert.equal(
    buildAction({ ...superseded, supersededBy: null }, member, notOwner),
    undefined,
  );
});

test("every failure a new request can fix offers Try again", () => {
  for (const cause of [
    "exit",
    "upload-rejected",
    "unsupported-mokly-version",
    "uncommitted-changes",
    "output-limit",
    "deadline",
    "idle",
    "infrastructure",
    "repository-unavailable",
  ] as const) {
    assert.deepEqual(buildAction(failed(cause), member, notOwner), {
      kind: "try-again",
    });
    // A reader who cannot request builds has no way on from this card.
    assert.equal(buildAction(failed(cause), reviewer, notOwner), undefined);
  }
  const cancelled = build({ state: "cancelled", canCancel: false });
  assert.deepEqual(buildAction(cancelled, member, notOwner), {
    kind: "try-again",
  });
});

test("a lockfile builds cannot install offers the CI guide to everyone", () => {
  for (const project of [member, reviewer])
    assert.deepEqual(
      buildAction(failed("unsupported-lockfile"), project, notOwner),
      { kind: "publish-from-ci" },
    );
});

test("a plan refusal offers Billing to an owner and nothing to anyone else", () => {
  assert.deepEqual(buildAction(failed("plan-required"), member, owner), {
    kind: "open-billing",
  });
  for (const role of [notOwner, { kind: "pending" }] satisfies WorkspaceRole[])
    assert.equal(buildAction(failed("plan-required"), member, role), undefined);
});
