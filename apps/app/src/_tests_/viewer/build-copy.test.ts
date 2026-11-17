import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import type { BuildFailure } from "../../api/types";
import { askAnOwnerToUpgrade } from "../../api/labels";
import {
  buildLine,
  buildSteps,
  buildTitle,
  causeSentences,
  elisionText,
  stepWords,
} from "../../viewer/build-copy";
import type { WorkspaceRole } from "../../viewer/workspace-role";
import { repositoryRoot } from "../root";
import { build, buildPullRequest } from "./build-fixtures";

const owner: WorkspaceRole = { kind: "owner" };
const notOwner: WorkspaceRole = { kind: "not-owner" };
const pending: WorkspaceRole = { kind: "pending" };

const contract = readFileSync(
  resolve(repositoryRoot, "docs/protocol/cloud/viewer-builds.md"),
  "utf8",
);

/** The body rows of the contract's Markdown table whose header starts so. */
function table(first: string): string[][] {
  const lines = contract.split("\n");
  const start = lines.findIndex((line) => line.startsWith("| " + first));
  assert.ok(start >= 0, first + " table");
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

test("every cause sentence is the viewer builds contract's own", () => {
  assert.deepEqual(
    Object.fromEntries(
      table("Cause").map(([cause, sentence]) => [
        cause.replaceAll("`", ""),
        sentence,
      ]),
    ),
    causeSentences,
  );
});

test("every title is the contract's, for a branch and a pull request", () => {
  const titles = Object.fromEntries(
    table("Build state").map(([state, title]) => [state, title]),
  );
  const pull = { pullRequest: buildPullRequest };
  const read = (state: Parameters<typeof build>[0]) => buildTitle(build(state));
  assert.equal(read({ state: "queued" }), titles["`queued`"]);
  assert.equal(read({ state: "running" }), titles["`running`"]);
  assert.equal(read({ state: "published" }), titles["`published`"]);
  assert.equal(read({ state: "failed" }), titles["`failed` or `timed-out`"]);
  assert.equal(read({ state: "timed-out" }), titles["`failed` or `timed-out`"]);
  assert.equal(read({ state: "superseded" }), titles["`superseded`"]);
  assert.equal(read({ state: "cancelled" }), titles["`cancelled`"]);
  // A pull request's build reads this pull request wherever the table reads
  // this branch.
  assert.equal(
    read({ state: "running", ...pull }),
    "Publishing this pull request",
  );
  assert.equal(
    read({ state: "published", ...pull }),
    "Published this pull request",
  );
  assert.equal(
    read({ state: "timed-out", ...pull }),
    "Unable to publish this pull request",
  );
});

test("a plan refusal takes the Team card's title", () => {
  const refused = build({
    state: "failed",
    step: null,
    failure: { step: null, cause: "plan-required", exitCode: null },
  });
  assert.equal(
    buildTitle(refused),
    "Publishing to private projects is on Team",
  );
  // Only an owner has the way on, so only everyone else reads the sentence,
  // and nothing is said until the workspace read has said which.
  assert.equal(buildLine(refused, owner), undefined);
  assert.deepEqual(buildLine(refused, notOwner), {
    kind: "plan",
    text: askAnOwnerToUpgrade,
  });
  assert.equal(buildLine(refused, pending), undefined);
});

test("the line says why a build ended, or that it waits", () => {
  assert.deepEqual(buildLine(build({ state: "queued" }), notOwner), {
    kind: "waiting",
    text: "Waiting to start.",
  });
  assert.equal(buildLine(build({ state: "running" }), notOwner), undefined);
  assert.equal(buildLine(build({ state: "cancelled" }), notOwner), undefined);
  const failed = (
    cause: BuildFailure["cause"],
    step: "install" | "publish" | null,
  ) =>
    buildLine(
      build({
        state:
          cause === "deadline" || cause === "idle" ? "timed-out" : "failed",
        step,
        failure: {
          step,
          cause,
          exitCode: cause === "exit" ? 1 : null,
        },
      }),
      notOwner,
    );
  // Every failure's line is its cause's sentence.
  for (const cause of [
    "exit",
    "upload-rejected",
    "output-limit",
    "infrastructure",
  ] as const)
    assert.equal(failed(cause, "install")?.kind, "cause");
  const text = (
    cause: BuildFailure["cause"],
    step: "install" | "publish" | null,
  ) => failed(cause, step)?.text;
  assert.equal(text("exit", "install"), "Installing dependencies failed.");
  assert.equal(text("exit", "publish"), "The catalogue couldn’t be built.");
  assert.equal(text("deadline", "publish"), causeSentences.deadline);
  assert.equal(
    text("output-limit", "publish"),
    "The build printed too much output; print less to publish.",
  );
  assert.equal(
    text("uncommitted-changes", "publish"),
    causeSentences["uncommitted-changes"],
  );
  assert.equal(
    text("unsupported-lockfile", "install"),
    "Mokly installs with npm, pnpm or Yarn.",
  );
  assert.equal(
    text("repository-unavailable", null),
    causeSentences["repository-unavailable"],
  );
});

test("the steps and their words are the contract's", () => {
  assert.deepEqual(
    buildSteps.map((step) => step.name),
    ["Check out", "Install", "Publish"],
  );
  assert.deepEqual(Object.values(stepWords), [
    "Done",
    "Running",
    "Waiting",
    "Failed",
    "Stopped",
    "Not run",
  ]);
});

test("dropped output is measured at 1,000 bytes to the KB", () => {
  assert.equal(elisionText(1_412_866), "1.4 MB of output not kept");
  assert.equal(elisionText(65_536), "65.5 KB of output not kept");
  assert.equal(elisionText(999), "1.0 KB of output not kept");
});
