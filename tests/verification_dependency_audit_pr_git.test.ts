import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import {
  gitWrites,
  prHarness,
  updatePullRequest,
} from "./helpers/dependency_audit_pr.js";

test("every Git and npm child omits both API tokens and fixes author and committer", async () => {
  const h = prHarness();
  h.dependencies.env = {
    ...h.dependencies.env,
    github_token: "lowercase-token",
    gh_token: "lowercase-gh-token",
    GIT_AUTHOR_NAME: "human",
    GIT_AUTHOR_EMAIL: "human@example.test",
    GIT_COMMITTER_NAME: "human",
    GIT_COMMITTER_EMAIL: "human@example.test",
    npm_config_prefix: "/wrong",
    npm_config_workspace: "viewer",
    npm_config_registry: "https://registry.example.test",
  };
  h.state.tip = "a".repeat(40);
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.ok(h.commands.length > 0);
  for (const command of h.commands) {
    assert.equal(command.shell, false);
    assert.equal(command.cwd, "/repo");
    assert.equal(command.env?.GITHUB_TOKEN, undefined);
    assert.equal(command.env?.GH_TOKEN, undefined);
    assert.equal(command.env?.github_token, undefined);
    assert.equal(command.env?.gh_token, undefined);
    assert.equal(command.env?.GIT_AUTHOR_NAME, "github-actions[bot]");
    assert.equal(command.env?.GIT_COMMITTER_NAME, "github-actions[bot]");
    assert.equal(
      command.env?.GIT_AUTHOR_EMAIL,
      "41898282+github-actions[bot]@users.noreply.github.com",
    );
    assert.equal(
      command.env?.GIT_COMMITTER_EMAIL,
      command.env?.GIT_AUTHOR_EMAIL,
    );
    assert.equal(command.env?.npm_config_prefix, undefined);
    assert.equal(command.env?.npm_config_workspace, undefined);
    assert.equal(
      command.env?.npm_config_registry,
      "https://registry.example.test",
    );
  }
  assert.equal(h.dependencies.env.GITHUB_TOKEN, "fixture-token");
});

for (const operation of [
  "git fetch origin +refs/heads/main:refs/remotes/origin/main",
  "git ls-remote --heads origin refs/heads/dependency-audit/main",
  `git fetch origin ${"a".repeat(40)}`,
  `git rev-list origin/main..${"a".repeat(40)}`,
  `git log -1 --format=%an%x00%ae%x00%cn%x00%ce ${"b".repeat(40)}`,
  "git checkout -B dependency-audit/main origin/main",
  "npm ci --ignore-scripts",
  "npm update braces --ignore-scripts",
  "git status --porcelain=v1 -z --untracked-files=all",
  "git add -- package-lock.json",
  "git -c user.name=github-actions[bot] -c user.email=41898282+github-actions[bot]@users.noreply.github.com commit -m fix(deps): update audited dependencies",
  `git push --force-with-lease=refs/heads/dependency-audit/main:${"a".repeat(40)} origin HEAD:refs/heads/dependency-audit/main`,
]) {
  test(`command failure stops maintenance: ${operation}`, async () => {
    const h = prHarness();
    h.state.tip = "a".repeat(40);
    h.state.commandFailure = operation;
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    const errors = h.output.errors.join("\n");
    assert.ok(errors.includes(operation));
    assert.match(errors, /fixture command failed/u);
    assert.match(errors, /retry/u);
    assert.equal(h.events.at(-1), operation);
    assert.equal(
      h.requests.some((r) => r.method !== "GET"),
      false,
    );
  });
}

test("a failed deletion lease fails after closing without a REST branch deletion", async () => {
  const h = prHarness(true);
  h.state.tip = "a".repeat(40);
  h.state.pulls = [updatePullRequest()];
  h.state.commandFailure = `git push --force-with-lease=refs/heads/dependency-audit/main:${h.state.tip} origin :refs/heads/dependency-audit/main`;
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.equal(
    h.requests.some((r) => r.method === "DELETE"),
    false,
  );
  assert.ok(
    h.requests.some(
      (r) =>
        r.method === "PATCH" &&
        (r.body as { state: string }).state === "closed",
    ),
  );
});

test("a human commit anywhere in history preserves the branch", async () => {
  const h = prHarness();
  h.state.tip = "a".repeat(40);
  h.state.pulls = [updatePullRequest()];
  h.state.commits.push("c".repeat(40));
  h.state.identities.set("c".repeat(40), "human");
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.equal(h.commands.filter((c) => c.args[0] === "log").length, 2);
  assert.deepEqual(gitWrites(h.commands), []);
});

test("command launch and signal failures keep diagnostics without exposing tokens", async () => {
  for (const signal of [false, true]) {
    const h = prHarness();
    h.dependencies.runCommand = async () => {
      if (!signal)
        throw new Error("fixture-token fixture-gh-token launch failure");
      return {
        exitCode: 0,
        signal: "SIGTERM",
        stdout: "",
        stderr: "fixture-token fixture-gh-token signal failure",
      };
    };
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    const errors = h.output.errors.join("\n");
    assert.doesNotMatch(errors, /fixture-token|fixture-gh-token/u);
    assert.match(errors, signal ? /SIGTERM/u : /launch failure/u);
    assert.match(errors, /retry/u);
  }
});
