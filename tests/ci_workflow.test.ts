import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const resultVariables = [
  "REPOSITORY_RESULT",
  "PACKAGE_RESULT",
  "UNIT_RESULT",
  "BROWSER_RESULT",
  "NATIVE_RESULT",
] as const;

interface WorkflowStep {
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  if?: string;
  name?: string;
  needs?: readonly string[];
  outputs?: Readonly<Record<string, string>>;
  steps: readonly WorkflowStep[];
  strategy?: {
    "fail-fast"?: boolean;
    matrix: Readonly<Record<string, readonly (string | number)[]>>;
  };
  "timeout-minutes"?: number;
}

interface Workflow {
  concurrency: { "cancel-in-progress": boolean };
  env: Readonly<Record<string, string>>;
  jobs: Readonly<Record<string, WorkflowJob>>;
  on: Readonly<Record<string, unknown>>;
  permissions: Readonly<Record<string, string>>;
}

test("CI shards complete verification behind one prerequisite", async () => {
  const source = await workflowSource();
  const workflow = parse(source) as Workflow;
  assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "push"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [
    "browser",
    "native",
    "package",
    "repository",
    "required",
    "unit",
  ]);
  const repository = workflow.jobs.repository;
  const packageJob = workflow.jobs.package;
  const unit = workflow.jobs.unit;
  const browser = workflow.jobs.browser;
  const native = workflow.jobs.native;
  const required = workflow.jobs.required;
  assert.ok(repository);
  assert.ok(packageJob);
  assert.ok(unit);
  assert.ok(browser);
  assert.ok(native);
  assert.ok(required);
  for (const job of Object.values(workflow.jobs))
    assert.equal(job["timeout-minutes"], 20);
  assert.deepEqual(required.needs, [
    "repository",
    "package",
    "unit",
    "browser",
    "native",
  ]);
  assert.equal(required.name, "Required CI");
  assert.equal(required.if, "always()");
  for (const job of [packageJob, unit, browser, native])
    assert.deepEqual(job.needs, ["repository"]);
  assert.deepEqual(packageJob.strategy?.matrix.node, ["22.14.0", "24"]);
  for (const job of [unit, browser]) {
    assert.equal(job.strategy?.["fail-fast"], false);
    assert.deepEqual(job.strategy?.matrix.node, ["22.14.0", "24"]);
    assert.deepEqual(job.strategy?.matrix.shard, [1, 2, 3, 4]);
  }
  assert.equal(native.strategy?.["fail-fast"], false);
  assert.deepEqual(native.strategy?.matrix.os, [
    "blacksmith-6vcpu-macos-15",
    "blacksmith-4vcpu-windows-2025",
  ]);
  assert.ok(
    repository.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite repository"),
    ),
  );
  assert.ok(
    packageJob.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite package"),
    ),
  );
  assert.ok(
    unit.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite unit --shard"),
    ),
  );
  assert.ok(
    browser.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite browser --shard"),
    ),
  );
  assert.equal(
    (source.match(/playwright install --with-deps chromium/g) ?? []).length,
    1,
  );
  assert.match(source, /include-hidden-files: true/);
  assert.match(source, /scripts\/verification\/aggregate\.mjs/);
  for (const job of [unit, browser]) {
    const upload = job.steps.find((step) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    assert.match(
      String(upload?.with?.name),
      /^verification-.+-node-\$\{\{ matrix\.node \}\}-shard-\$\{\{ matrix\.shard \}\}$/,
    );
    assert.equal(upload?.with?.overwrite, true);
  }
  const download = required.steps.find((step) =>
    step.uses?.startsWith("actions/download-artifact@"),
  );
  assert.equal(download?.with?.pattern, "verification-*");
  assert.ok(
    native.steps.some((step) =>
      step.run?.includes("tests/export_rename.test.ts"),
    ),
  );
  assert.ok(
    native.steps.some((step) =>
      step.run?.includes("tests/export_destination_races.test.ts"),
    ),
  );
  for (const job of [repository, packageJob, unit, browser, native]) {
    assertFullHistoryCheckout(job);
    const setupNode = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(setupNode?.with?.cache, "npm");
    assert.ok(job.steps.some((step) => step.run === "npm ci"));
  }
  assertPinnedActions(workflow);
});

test("CI resolves the latest Node 24 patch once for every dependent job", async () => {
  const source = await workflowSource();
  const workflow = parse(source) as Workflow;
  assert.equal(workflow.env.NODE_24_VERSION, undefined);
  const repository = workflow.jobs.repository;
  assert.ok(repository);
  const setupIndex = repository.steps.findIndex((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  const captureIndex = repository.steps.findIndex(
    (step) => step.name === "Capture exact Node.js version",
  );
  assert.ok(setupIndex >= 0 && captureIndex > setupIndex);
  const repositorySetup = repository.steps[setupIndex];
  const capture = repository.steps[captureIndex];
  assert.equal(repositorySetup?.with?.["node-version"], 24);
  assert.equal(capture?.id, "node-version");
  assert.equal(
    capture?.run,
    `echo "value=$(node --print 'process.versions.node')" >> "$GITHUB_OUTPUT"`,
  );
  assert.equal(
    repository.outputs?.["node-24-version"],
    "${{ steps.node-version.outputs.value }}",
  );
  assert.doesNotMatch(source, /steps\.node\.outputs\.node-version/);
  for (const name of ["package", "unit", "browser", "required"]) {
    const job = workflow.jobs[name];
    assert.ok(job, name);
    assert.ok(job.needs?.includes("repository"), name);
    const setup = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(
      setup?.with?.["node-version"],
      name === "required"
        ? "${{ needs.repository.outputs.node-24-version }}"
        : "${{ matrix.node == '24' && needs.repository.outputs.node-24-version || matrix.node }}",
      `${name} must reuse the exact Node 24 version captured by the prerequisite`,
    );
  }
});

test("Required CI fails closed for every prerequisite result", async (context) => {
  const source = await workflowSource();
  const workflow = parse(source) as Workflow;
  const required = workflow.jobs.required;
  assert.ok(required);
  const guard = required.steps.find(
    (step) => step.name === "Require every verification job",
  )?.run;
  assert.ok(guard);

  const successful = Object.fromEntries(
    resultVariables.map((variable) => [variable, "success"]),
  );
  await assert.doesNotReject(runGuard(guard, successful));

  for (const variable of resultVariables) {
    for (const result of ["failure", "skipped", "cancelled", ""]) {
      await context.test(
        `${variable} rejects ${result || "empty"}`,
        async () => {
          await assert.rejects(
            runGuard(guard, { ...successful, [variable]: result }),
          );
        },
      );
    }
  }
});

async function runGuard(
  script: string,
  results: Readonly<Record<string, string>>,
): Promise<void> {
  await execute(
    "bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
    { cwd: repositoryRoot, env: { ...process.env, ...results } },
  );
}

async function workflowSource(): Promise<string> {
  return await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
}

function assertPinnedActions(workflow: Workflow): void {
  const actions = Object.values(workflow.jobs).flatMap((job) =>
    job.steps.flatMap((step) => (step.uses ? [step.uses] : [])),
  );
  assert.ok(actions.length > 0);
  for (const action of actions) assert.match(action, /@[a-f0-9]{40}$/);
}

function assertFullHistoryCheckout(job: WorkflowJob): void {
  const checkout = job.steps.find((step) =>
    step.uses?.startsWith("useblacksmith/checkout@"),
  );
  assert.ok(checkout);
  assert.equal(checkout.with?.["fetch-depth"], 0);
}
