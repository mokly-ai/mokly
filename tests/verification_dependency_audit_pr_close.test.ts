import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import {
  gitWrites,
  prHarness,
  updatePullRequest,
} from "./helpers/dependency_audit_pr.js";

for (const human of [false, true]) {
  test(`success closes only matching open requests and preserves human branches: ${human}`, async () => {
    const h = prHarness(true);
    h.state.tip = "a".repeat(40);
    h.state.pulls = [
      updatePullRequest(),
      updatePullRequest(8),
      {
        ...updatePullRequest(9, {
          head: {
            ref: "another-branch",
            repo: { full_name: "mokly-ai/mokly" },
          },
        }),
        labels: [{ name: "dependency-audit" }],
      },
      updatePullRequest(10, {
        head: {
          ref: "dependency-audit/main",
          repo: { full_name: "fork/mokly" },
        },
      }),
      updatePullRequest(11, { state: "closed" }),
    ];
    if (human) h.state.identities.set(h.state.commits[0]!, "human");
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
    assert.deepEqual(
      h.requests
        .filter((r) => r.method !== "GET")
        .map((r) => [r.method, r.path]),
      [
        ["POST", "/repos/mokly-ai/mokly/issues/7/comments"],
        ["PATCH", "/repos/mokly-ai/mokly/pulls/7"],
        ["POST", "/repos/mokly-ai/mokly/issues/8/comments"],
        ["PATCH", "/repos/mokly-ai/mokly/pulls/8"],
      ],
    );
    for (const request of h.requests.filter((r) =>
      r.path.endsWith("/comments"),
    ))
      assert.match(
        (request.body as { body: string }).body,
        /actions\/runs\/1234/u,
      );
    const writes = gitWrites(h.commands);
    assert.equal(writes.length, human ? 0 : 1);
    if (!human)
      assert.deepEqual(writes[0]?.args, [
        "push",
        `--force-with-lease=refs/heads/dependency-audit/main:${h.state.tip}`,
        "origin",
        ":refs/heads/dependency-audit/main",
      ]);
  });
}

test("success without a pull request or branch makes no mutation", async () => {
  const h = prHarness(true);
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.deepEqual(gitWrites(h.commands), []);
  assert.equal(
    h.requests.some((r) => r.method !== "GET"),
    false,
  );
});

test("success deletes an orphan bot branch with no commits beyond main", async () => {
  const h = prHarness(true);
  h.state.tip = "a".repeat(40);
  h.state.commits = [];
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.equal(gitWrites(h.commands).length, 1);
});
