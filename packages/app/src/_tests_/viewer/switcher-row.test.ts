import assert from "node:assert/strict";
import { test } from "node:test";

import type { Branch, PullRequest } from "../../api/types";
import {
  branchPath,
  buildPath,
  publicationPath,
  pullRequestPath,
} from "../../navigation/paths";
import { referenceStage } from "../../viewer/reference-stage";
import { rowTarget } from "../../viewer/switcher-row";
import type { RefRow } from "../../viewer/switcher-row";

import { attempt, branchRow, pullRow, summary } from "./build-fixtures";

/**
 * Where a switcher row leads, as the Details rule of
 * `viewer-build-navigation.md` gives it: a row with nothing ready whose newest
 * build failed opens that build's address, including where the reference's own
 * stage shows a closed pull request's, a fork's or the plan's card instead.
 */

const workspace = "acme";
const project = "catalogue";

/** A failed build newer than every publication attempt of its reference. */
const failedBuild = summary({
  state: "failed",
  createdAt: "2026-09-15T16:00:00Z",
});

/** The switcher's row of one branch, as `readRefs` builds it. */
function branchRefRow(branch: Branch): RefRow {
  return {
    ref: { kind: "branch", name: branch.name },
    title: branch.name,
    ready: branch.latestPublicationId,
    newest: branch.newestPublication,
    newestBuild: branch.newestBuild,
  };
}

/** The switcher's row of one pull request, as `readRefs` builds it. */
function pullRefRow(pull: PullRequest): RefRow {
  return {
    ref: { kind: "pull-request", number: pull.number },
    title: "#" + pull.number + " " + pull.title,
    author: pull.author ?? undefined,
    ready: pull.latestPublicationId,
    newest: pull.newestPublication,
    newestBuild: pull.newestBuild,
  };
}

const failedBuildAddress = buildPath(workspace, project, failedBuild.id);

test("Details on a failed build opens its address where the stage shows another card", () => {
  const older = attempt({
    state: "failed",
    publishedAt: "2026-09-15T15:00:00Z",
  });
  const rows = [
    { name: "a closed pull request", row: pullRow({ state: "closed" }) },
    { name: "a merged pull request", row: pullRow({ state: "merged" }) },
    { name: "a fork's pull request", row: pullRow({ fork: true }) },
  ];
  for (const { name, row } of rows)
    for (const newest of [null, older]) {
      const pull = {
        ...row,
        newestBuild: failedBuild,
        newestPublication: newest,
      };
      // Its own stage names how it closed or that it is a fork's, for every
      // plan, so following the reference would not reach the build.
      for (const publishingAllowed of [true, false])
        assert.equal(
          referenceStage(pull, publishingAllowed).kind,
          "card",
          name,
        );
      const target = rowTarget(pullRefRow(pull), workspace, project);
      assert.equal(target.details, true, name);
      assert.equal(target.href, failedBuildAddress, name);
      assert.equal(target.state.state, "failed", name);
      assert.equal(target.state.headSha, failedBuild.headSha, name);
    }
});

test("Details on a failed build opens its address while the plan refuses", () => {
  const branch = branchRow("topic", { newestBuild: failedBuild });
  const pull = pullRow({ newestBuild: failedBuild });
  for (const [row, shown] of [
    [branch, branchRefRow(branch)],
    [pull, pullRefRow(pull)],
  ] as const) {
    // While the plan refuses publishing the stage shows the Team card, not
    // the failed build.
    assert.deepEqual(referenceStage(row, false), {
      kind: "card",
      closed: undefined,
      fork: false,
    });
    const target = rowTarget(shown, workspace, project);
    assert.equal(target.details, true, shown.title);
    assert.equal(target.href, failedBuildAddress, shown.title);
  }
});

test("Details on an ordinary failed or timed-out build opens its address too", () => {
  for (const state of ["failed", "timed-out"] as const) {
    const build = { ...failedBuild, state };
    const row = branchRow("topic", { newestBuild: build });
    assert.deepEqual(referenceStage(row, true), {
      kind: "build",
      buildId: build.id,
    });
    const target = rowTarget(branchRefRow(row), workspace, project);
    assert.equal(target.details, true, state);
    assert.equal(target.href, buildPath(workspace, project, build.id));
  }
});

test("Details on a failed publication opens its own details", () => {
  const failed = attempt({ state: "failed" });
  const target = rowTarget(
    branchRefRow(branchRow("topic", { newestPublication: failed })),
    workspace,
    project,
  );
  assert.deepEqual(target, {
    state: {
      state: "failed",
      headSha: failed.headSha,
      publishedAt: failed.publishedAt,
      fromBuild: false,
    },
    details: true,
    href: publicationPath(workspace, project, failed.id),
  });
  // A failed publication newer than a failed build is what the row says.
  const newer = attempt({
    state: "failed",
    publishedAt: "2026-09-15T17:00:00Z",
  });
  assert.equal(
    rowTarget(
      pullRefRow(
        pullRow({ newestBuild: failedBuild, newestPublication: newer }),
      ),
      workspace,
      project,
    ).href,
    publicationPath(workspace, project, newer.id),
  );
});

test("a row with a ready publication or nothing failed opens its reference", () => {
  const ready = attempt();
  const opened = [
    // A ready publication still wins over a newer failed build.
    branchRow("topic", {
      latestPublicationId: ready.id,
      newestPublication: ready,
      newestBuild: failedBuild,
    }),
    branchRow("topic", { newestBuild: summary({ state: "running" }) }),
    branchRow("topic", { newestBuild: summary({ state: "cancelled" }) }),
    branchRow("topic"),
  ];
  for (const row of opened) {
    const target = rowTarget(branchRefRow(row), workspace, project);
    assert.equal(target.details, false);
    assert.equal(target.href, branchPath(workspace, project, "topic"));
  }
  const pull = rowTarget(
    pullRefRow(pullRow({ newestBuild: summary({ state: "queued" }) })),
    workspace,
    project,
  );
  assert.equal(pull.details, false);
  assert.equal(pull.href, pullRequestPath(workspace, project, 14));
});
