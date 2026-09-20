import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface WorkflowStep {
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  if?: string;
  steps: readonly WorkflowStep[];
}

interface Workflow {
  env: Readonly<Record<string, string>>;
  jobs: Readonly<Record<string, WorkflowJob>>;
  on: Readonly<Record<string, unknown>>;
  permissions: Readonly<Record<string, string>>;
}

test("preview workflow deploys main and same-repository pull requests", async () => {
  const source = await fs.promises.readFile(
    path.join(repositoryRoot, ".github", "workflows", "preview.yml"),
    "utf8",
  );
  const workflow = parse(source) as Workflow;

  assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "push"]);
  assert.deepEqual(workflow.permissions, {
    contents: "read",
    "pull-requests": "write",
  });
  assert.equal(workflow.env.CLOUDFLARE_PROJECT_NAME, "mokabook");
  assert.equal(workflow.env.MOKLY_COMMENT_MARKER, "<!-- mokly-preview -->");
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [
    "close-pr",
    "deploy-main",
    "deploy-pr",
  ]);

  const deployMain = workflow.jobs["deploy-main"];
  const deployPullRequest = workflow.jobs["deploy-pr"];
  const closePullRequest = workflow.jobs["close-pr"];
  assert.ok(deployMain);
  assert.ok(deployPullRequest);
  assert.ok(closePullRequest);
  assert.match(deployMain.if ?? "", /github\.event_name == 'push'/);
  assert.match(deployPullRequest.if ?? "", /head\.repo\.full_name/);
  assert.match(deployPullRequest.if ?? "", /release-please--/);
  assert.match(closePullRequest.if ?? "", /github\.event\.action == 'closed'/);
  assert.equal((source.match(/npm run preview:build/g) ?? []).length, 2);
  assert.match(source, /--branch main/);
  assert.match(source, /branch="pr-\$\{\{/);
  assert.match(source, /Mokly preview/);
  assert.match(source, /deployment_trigger\.metadata\.branch/);
  assert.equal(
    deployMain.steps.find((step) =>
      step.run?.startsWith("npm run preview:build"),
    )?.run,
    "npm run preview:build",
  );
  assert.equal(
    deployPullRequest.steps.find((step) =>
      step.run?.startsWith("npm run preview:build"),
    )?.run,
    "npm run preview:build -- --include-changes --base origin/main",
  );
  assertFullHistoryCheckout(deployMain);
  assertFullHistoryCheckout(deployPullRequest);
  assertPinnedActions(workflow);
});

test("browser checks support an isolated workspace port", async () => {
  const [config, browseTest] = await Promise.all([
    fs.promises.readFile(
      path.join(repositoryRoot, "playwright.config.ts"),
      "utf8",
    ),
    fs.promises.readFile(
      path.join(repositoryRoot, "tests", "browser", "browse.spec.ts"),
      "utf8",
    ),
  ]);
  assert.match(config, /process\.env\["MOKLY_PLAYWRIGHT_PORT"\]/);
  assert.match(config, /globalSetup: "\.\/tests\/browser\/setup\.ts"/);
  assert.match(browseTest, /browser\.newContext\(\{\s+baseURL,/);
  assert.doesNotMatch(browseTest, /127\.0\.0\.1:4517/);
});

test("PR install caching includes the branch-point lockfile and verification retains full history", async () => {
  const preview = parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, ".github/workflows/preview.yml"),
      "utf8",
    ),
  ) as Workflow;
  const steps = preview.jobs["deploy-pr"]!.steps;
  const lockIndex = steps.findIndex(
    (step) => step.name === "Read baseline dependency lockfile",
  );
  const nodeIndex = steps.findIndex((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  const installIndex = steps.findIndex((step) => step.run === "npm ci");
  assert.ok(
    lockIndex >= 0 && lockIndex < nodeIndex && nodeIndex < installIndex,
  );
  assert.match(steps[lockIndex]!.run!, /git merge-base HEAD origin\/main/);
  assert.match(
    steps[lockIndex]!.run!,
    /git show "\$\{baseline_commit\}:package-lock.json" > .context\/baseline-package-lock.json/,
  );
  assert.equal(steps[nodeIndex]!.with?.cache, "npm");
  assert.deepEqual(
    String(steps[nodeIndex]!.with?.["cache-dependency-path"])
      .trim()
      .split("\n"),
    ["package-lock.json", ".context/baseline-package-lock.json"],
  );
  const ci = parse(
    await fs.promises.readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ),
  ) as Workflow;
  for (const job of ["repository", "package", "unit", "browser", "native"])
    assertFullHistoryCheckout(ci.jobs[job]!);
});

function assertPinnedActions(workflow: Workflow): void {
  const actions = Object.values(workflow.jobs).flatMap((job) =>
    job.steps.flatMap((step) => (step.uses ? [step.uses] : [])),
  );
  assert.ok(actions.length > 0);
  for (const action of actions) assert.match(action, /@[a-f0-9]{40}$/);
}

function assertFullHistoryCheckout(job: WorkflowJob): void {
  const checkout = job.steps.find((step) =>
    step.uses?.startsWith("actions/checkout@"),
  );
  assert.ok(checkout);
  assert.equal(checkout.with?.["fetch-depth"], 0);
}
