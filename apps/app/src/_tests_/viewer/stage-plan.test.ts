import assert from "node:assert/strict";
import { test } from "node:test";

import type { Workspace, Project } from "../../api/types";
import type { Resource } from "../../data/use-resource";
import { referenceStage } from "../../viewer/reference-stage";
import type { ReferenceRow } from "../../viewer/reference-stage";
import { unpublishedStage } from "../../viewer/stage-view-decision";

import { attempt, branchRow, pullRow, summary } from "./build-fixtures";
import { flags, projects, reads } from "./stage-cases";

/**
 * The plan's part of the reference stage order in `viewer-builds.md`: while
 * the plan refuses publishing, every reference that no running build, closed
 * card or fork card answers for shows the Team card under the
 * workspace-role rule, an open pull request of the project's repository as
 * much as a branch; the pull request waiting card, which says its check will
 * publish it, appears only while the plan allows publishing.
 */

/** A reference row the stage can be asked about, with what kind it is. */
interface Reference {
  name: string;
  pullRequest: boolean;
  row: ReferenceRow | undefined;
}

/** A failed build newer than every publication attempt. */
const failedBuild = summary({
  state: "failed",
  createdAt: "2026-09-15T16:00:00Z",
});

/** A failed publication attempt older than that build. */
const failedPublication = attempt({
  state: "failed",
  publishedAt: "2026-09-15T15:00:00Z",
});

/**
 * Every kind of reference the stage decides for: a branch, the standalone
 * entry of a project with no branch, and a pull request that is open, closed,
 * merged or from a fork, each with nothing, a failed build or a failed
 * publication as its newest attempt.
 */
const referenceRows: Reference[] = [
  { name: "a project with no branch", pullRequest: false, row: undefined },
  ...[
    {},
    { newestBuild: failedBuild },
    { newestPublication: failedPublication },
  ].flatMap((newest, index) => [
    {
      name: "a branch #" + index,
      pullRequest: false,
      row: branchRow("topic", newest),
    },
    {
      name: "an open pull request #" + index,
      pullRequest: true,
      row: pullRow(newest),
    },
    {
      name: "a closed pull request #" + index,
      pullRequest: true,
      row: pullRow({ state: "closed", ...newest }),
    },
    {
      name: "a merged pull request #" + index,
      pullRequest: true,
      row: pullRow({ state: "merged", ...newest }),
    },
    {
      name: "a fork's pull request #" + index,
      pullRequest: true,
      row: pullRow({ fork: true, ...newest }),
    },
  ]),
];

/**
 * What the stage shows at one reference for one project, workspace read and
 * reader: one of its own attempts, or the card the decision chooses.
 */
function stageAt(
  reference: Reference,
  project: Project,
  read: Resource<Workspace>,
  member: boolean,
): string {
  const stage = referenceStage(reference.row, project.publishingAllowed);
  if (stage.kind !== "card") return stage.kind;
  const card = unpublishedStage(project, read, reference.pullRequest, {
    reference: reference.pullRequest
      ? { kind: "pull-request", number: 14 }
      : reference.row
        ? { kind: "branch", name: "topic" }
        : undefined,
    member,
    closed: stage.closed,
    fork: stage.fork,
  });
  return card.kind === "plan-required"
    ? card.kind + (card.canUpgrade ? " owner" : " reader")
    : card.kind;
}

/** Every case of the matrix: reference, plan, build availability, reader. */
function* cases() {
  for (const reference of referenceRows)
    for (const project of projects)
      for (const read of reads)
        for (const member of flags)
          yield {
            reference,
            project,
            read,
            member,
            shown: stageAt(reference, project, read, member),
          };
}

test("the waiting card appears only while the plan allows publishing", () => {
  const waiting = new Set<string>();
  for (const { reference, project, shown } of cases()) {
    if (shown !== "pull-request") continue;
    assert.equal(
      project.publishingAllowed,
      true,
      reference.name + " waits for its check while the plan refuses",
    );
    waiting.add(project.buildsAvailable ? "builds" : "no builds");
  }
  // The card is still reached while the plan allows publishing: in a project
  // that cannot build, and for a reader who cannot see builds in one that can.
  assert.deepEqual([...waiting].sort(), ["builds", "no builds"]);
});

test("while the plan refuses, an open pull request shows the card a branch shows", () => {
  for (const { reference, project, read, member, shown } of cases()) {
    if (project.publishingAllowed || !reference.pullRequest) continue;
    const row = reference.row as ReturnType<typeof pullRow>;
    if (row.state !== "open" || row.fork) continue;
    const branch = stageAt(
      { name: "a branch", pullRequest: false, row: branchRow("topic") },
      project,
      read,
      member,
    );
    assert.equal(shown, branch, reference.name);
    assert.ok(
      [
        "plan-required owner",
        "plan-required reader",
        "pending-workspace",
        "unreadable-workspace",
      ].includes(shown),
      reference.name + " shows " + shown,
    );
  }
});

test("the workspace-role rule chooses a refused pull request's Team card", () => {
  const refused = projects.filter(
    (project) => !project.publishingAllowed && project.buildsAvailable,
  );
  const pull: Reference = {
    name: "an open pull request",
    pullRequest: true,
    row: pullRow(),
  };
  const [loading, owner, member, notFound, unavailable] = reads;
  for (const project of refused)
    for (const reader of flags) {
      assert.equal(
        stageAt(pull, project, loading, reader),
        "pending-workspace",
      );
      assert.equal(
        stageAt(pull, project, owner, reader),
        "plan-required owner",
      );
      assert.equal(
        stageAt(pull, project, member, reader),
        "plan-required reader",
      );
      assert.equal(
        stageAt(pull, project, notFound, reader),
        "plan-required reader",
      );
      assert.equal(
        stageAt(pull, project, unavailable, reader),
        "unreadable-workspace",
      );
    }
});

test("a closed or fork pull request keeps its own card while the plan refuses", () => {
  for (const { reference, project, shown } of cases()) {
    if (project.publishingAllowed || !reference.pullRequest) continue;
    const row = reference.row as ReturnType<typeof pullRow>;
    if (row.state !== "open")
      assert.equal(shown, "closed-pull-request", reference.name);
    else if (row.fork) assert.equal(shown, "fork-pull-request", reference.name);
  }
});
