import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import {
  gitWrites,
  prFinding,
  prHarness,
  updatePullRequest,
} from "./helpers/dependency_audit_pr.js";

test("first failure updates each distinct package, commits, pushes, labels and opens", async () => {
  const h = prHarness();
  h.files.set(
    "report.json",
    JSON.stringify({
      mode: "strict",
      ok: false,
      issues: [prFinding, prFinding, { ...prFinding, package: "@scope/pkg" }],
    }),
  );
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.deepEqual(
    h.commands.filter((command) => command.file === "npm").map((c) => c.args),
    [
      ["ci", "--ignore-scripts"],
      ["update", "braces", "--ignore-scripts"],
      ["update", "@scope/pkg", "--ignore-scripts"],
    ],
  );
  const writes = gitWrites(h.commands).map((command) => command.args);
  assert.deepEqual(writes[0], [
    "checkout",
    "-B",
    "dependency-audit/main",
    "origin/main",
  ]);
  assert.deepEqual(writes[1], ["add", "--", "package-lock.json"]);
  assert.ok(writes[2]?.includes("fix(deps): update audited dependencies"));
  assert.ok(writes[2]?.includes("user.name=github-actions[bot]"));
  assert.ok(
    writes[2]?.includes(
      "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    ),
  );
  assert.deepEqual(writes[3], [
    "push",
    "--force-with-lease=refs/heads/dependency-audit/main:",
    "origin",
    "HEAD:refs/heads/dependency-audit/main",
  ]);
  const mutations = h.requests.filter((request) => request.method !== "GET");
  assert.deepEqual(
    mutations.map((r) => `${r.method} ${r.path}`),
    [
      "POST /repos/mokly-ai/mokly/labels",
      "POST /repos/mokly-ai/mokly/pulls",
      "POST /repos/mokly-ai/mokly/issues/8/labels",
    ],
  );
  assert.deepEqual(mutations[1]?.body, {
    title: "fix(deps): resolve dependency audit findings",
    head: "dependency-audit/main",
    base: "main",
    body: assertBody(mutations[1]?.body),
  });
  assert.deepEqual(mutations[2]?.body, { labels: ["dependency-audit"] });
  const firstWrite = h.events.findIndex((event) =>
    event.startsWith("git checkout"),
  );
  assert.ok(h.events.indexOf("read:report.json") < firstWrite);
  assert.ok(h.events.indexOf("read:audit.log") < firstWrite);
});

function assertBody(value: unknown): string {
  const body = (value as { body: string }).body;
  assert.match(body, /2026-10-08/u);
  assert.ok(
    body.includes("https://github.com/mokly-ai/mokly/actions/runs/1234"),
  );
  assert.ok(
    body.includes(
      "https://github.com/mokly-ai/mokly/blob/main/docs/protocol/dependency-audit-update-pr.md",
    ),
  );
  assert.ok(body.includes("Uncovered finding."));
  assert.ok(
    body.includes(
      "If CI did not start on this pull request, push a commit to the branch or close and reopen the pull request.",
    ),
  );
  return body;
}

for (const exceptionOnly of [false, true]) {
  test(`no lockfile change tracks findings with an empty commit (exception-only: ${exceptionOnly})`, async () => {
    const h = prHarness();
    h.state.changes = "";
    if (exceptionOnly)
      h.files.set(
        "report.json",
        JSON.stringify({
          mode: "strict",
          ok: false,
          issues: [
            { kind: "exception", message: "Review the expired exception." },
          ],
        }),
      );
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
    const commit = h.commands.find((c) => c.args.includes("commit"));
    assert.ok(commit?.args.includes("--allow-empty"));
    assert.ok(
      commit?.args.includes("chore(deps): track dependency audit findings"),
    );
    assert.equal(
      h.commands.some((c) => c.args[0] === "add"),
      false,
    );
    assert.equal(
      h.commands.filter((c) => c.args[0] === "update").length,
      exceptionOnly ? 0 : 1,
    );
  });
}

for (const changes of [
  " M package.json\0",
  " M packages/viewer/package.json\0",
  "?? packages/new/package.json\0",
  "R  moved.json\0packages/viewer/package.json\0",
]) {
  test(`a changed manifest prevents committing and pushing: ${JSON.stringify(changes)}`, async () => {
    const h = prHarness();
    h.state.changes = changes;
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assert.match(h.output.errors.join("\n"), /package\.json.*Restore.*retry/u);
    assert.equal(
      h.commands.some((c) => c.args.includes("commit") || c.args[0] === "push"),
      false,
    );
    assert.equal(
      h.requests.some((r) => r.method !== "GET"),
      false,
    );
  });
}

for (const withPullRequest of [false, true]) {
  for (const noCommits of [false, true]) {
    test(`existing bot branch uses its inspected lease (PR: ${withPullRequest}, empty: ${noCommits})`, async () => {
      const h = prHarness();
      h.state.tip = "a".repeat(40);
      if (noCommits) h.state.commits = [];
      if (withPullRequest) h.state.pulls = [updatePullRequest()];
      assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
      assert.ok(
        h.commands.some(
          (c) => c.args[0] === "fetch" && c.args.includes(h.state.tip!),
        ),
      );
      assert.ok(
        h.commands.some(
          (c) =>
            c.args[0] === "rev-list" &&
            c.args[1] === `origin/main..${h.state.tip}`,
        ),
      );
      const push = h.commands.find((c) => c.args[0] === "push");
      assert.ok(
        push?.args.includes(
          `--force-with-lease=refs/heads/dependency-audit/main:${h.state.tip}`,
        ),
      );
      assert.equal(
        h.requests.some(
          (r) => r.method === "POST" && r.path.endsWith("/pulls"),
        ),
        !withPullRequest,
      );
      if (withPullRequest)
        assert.ok(
          h.requests.some(
            (r) => r.method === "PATCH" && r.path.endsWith("/pulls/7"),
          ),
        );
    });
  }
}

for (const field of [0, 1, 2, 3]) {
  test(`each author and committer field protects human commits: field ${field}`, async () => {
    const h = prHarness();
    h.state.tip = "a".repeat(40);
    h.state.pulls = [updatePullRequest()];
    const identity = h.botIdentity.split("\0");
    identity[field] = "human";
    h.state.identities.set(h.state.commits[0]!, identity.join("\0"));
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
    assert.deepEqual(gitWrites(h.commands), []);
    assert.equal(
      h.commands.some((c) => c.file === "npm"),
      false,
    );
    assert.ok(
      h.requests.some(
        (r) => r.method === "PATCH" && r.path.endsWith("/pulls/7"),
      ),
    );
  });
}

test("a human branch without an open pull request fails with a recovery action", async () => {
  const h = prHarness();
  h.state.tip = "a".repeat(40);
  h.state.identities.set(
    h.state.commits[0]!,
    "human\0human@example.test\0human\0human@example.test",
  );
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.match(
    h.output.errors.join("\n"),
    /dependency-audit\/main.*delete.*reopen/u,
  );
  assert.deepEqual(gitWrites(h.commands), []);
  assert.equal(
    h.requests.some((r) => r.method !== "GET"),
    false,
  );
});
