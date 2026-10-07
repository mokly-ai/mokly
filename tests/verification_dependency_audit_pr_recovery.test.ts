import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import {
  gitWrites,
  prHarness,
  updatePullRequest,
} from "./helpers/dependency_audit_pr.js";

const CLOSED =
  "GET /repos/mokly-ai/mokly/pulls?state=closed&head=mokly-ai:dependency-audit/main";

function humanBranch(closedHead: string) {
  const h = prHarness();
  h.state.tip = "a".repeat(40);
  h.state.identities.set(
    h.state.commits[0]!,
    "human\0human@example.test\0human\0human@example.test",
  );
  h.responses.set(CLOSED, {
    status: 200,
    body: [
      updatePullRequest(5, {
        state: "closed",
        head: {
          ref: "dependency-audit/main",
          sha: closedHead,
          repo: { full_name: "mokly-ai/mokly" },
        },
      }),
    ],
  });
  return h;
}

test("a human branch preserved by a closed update pull request is recreated", async () => {
  const h = humanBranch("a".repeat(40));
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  const writes = gitWrites(h.commands).map((command) => command.args);
  assert.deepEqual(writes[0], [
    "checkout",
    "-B",
    "dependency-audit/main",
    "origin/main",
  ]);
  assert.deepEqual(writes.at(-1), [
    "push",
    `--force-with-lease=refs/heads/dependency-audit/main:${"a".repeat(40)}`,
    "origin",
    "HEAD:refs/heads/dependency-audit/main",
  ]);
  const created = h.requests.find(
    (request) =>
      request.method === "POST" &&
      request.path === "/repos/mokly-ai/mokly/pulls",
  );
  const body = (created?.body as { body?: string } | undefined)?.body ?? "";
  assert.match(body, /maintainer commits\. They stay in #5\./u);
  assert.match(h.output.notices.join("\n"), /stay in #5/u);
  const firstWrite = h.events.findIndex((event) =>
    event.startsWith("git checkout"),
  );
  const lookup = h.events.indexOf(CLOSED);
  assert.ok(lookup >= 0 && lookup < firstWrite);
});

test("a closed pull request with another head cannot unlock a human branch", async () => {
  const h = humanBranch("c".repeat(40));
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.match(
    h.output.errors.join("\n"),
    /no closed update pull request preserves.*delete.*reopen/u,
  );
  assert.deepEqual(gitWrites(h.commands), []);
  assert.equal(
    h.requests.some((request) => request.method !== "GET"),
    false,
  );
});

test("an open update pull request keeps a human branch without a closed-list lookup", async () => {
  const h = humanBranch("a".repeat(40));
  h.state.pulls = [updatePullRequest()];
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.equal(h.events.includes(CLOSED), false);
  assert.deepEqual(gitWrites(h.commands), []);
});
