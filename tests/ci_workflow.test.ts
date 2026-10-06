import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { TESTED_NODE_VERSIONS } from "../dist/cli/bootstrap.js";

import { repositoryRoot } from "./helpers/fixture.js";

const [minimumTestedNode] = TESTED_NODE_VERSIONS;

interface WorkflowStep {
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  if?: string;
  name?: string;
  needs?: readonly string[];
  steps: readonly WorkflowStep[];
  strategy?: {
    "fail-fast"?: boolean;
    matrix: Readonly<Record<string, readonly (string | number)[] | string>>;
  };
  "timeout-minutes"?: number;
}

interface Workflow {
  concurrency: { "cancel-in-progress": boolean };
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
    "hydration",
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
  const hydration = workflow.jobs.hydration;
  const native = workflow.jobs.native;
  const required = workflow.jobs.required;
  assert.ok(repository);
  assert.ok(packageJob);
  assert.ok(unit);
  assert.ok(browser);
  assert.ok(hydration);
  assert.ok(native);
  assert.ok(required);
  for (const job of Object.values(workflow.jobs))
    assert.equal(job["timeout-minutes"], 30);
  assert.deepEqual(required.needs, [
    "repository",
    "package",
    "unit",
    "browser",
    "hydration",
    "native",
  ]);
  assert.equal(required.name, "Required CI");
  assert.equal(required.if, "always()");
  for (const job of [packageJob, unit, browser, hydration, native])
    assert.deepEqual(job.needs, ["repository"]);
  const selectedNodeMatrix =
    "${{ fromJSON(needs.repository.outputs.node-matrix) }}";
  assert.equal(packageJob.strategy?.matrix.node, selectedNodeMatrix);
  assert.equal(hydration.strategy?.matrix.node, selectedNodeMatrix);
  assert.equal(hydration.strategy?.["fail-fast"], false);
  assert.equal(hydration.strategy?.matrix.shard, undefined);
  for (const job of [unit, browser]) {
    assert.equal(job.strategy?.["fail-fast"], false);
    assert.equal(job.strategy?.matrix.node, selectedNodeMatrix);
    assert.deepEqual(job.strategy?.matrix.shard, [1, 2, 3, 4]);
  }
  assert.equal(native.strategy?.["fail-fast"], false);
  assert.deepEqual(native.strategy?.matrix.os, [
    "blacksmith-6vcpu-macos-15",
    "blacksmith-2vcpu-windows-2025",
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
  assert.ok(
    hydration.steps.some((step) =>
      step.run?.includes("cargo xtask check --suite hydration"),
    ),
  );
  assert.equal(
    (source.match(/playwright install --with-deps chromium/g) ?? []).length,
    2,
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
  const hydrationUpload = hydration.steps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  assert.equal(
    hydrationUpload?.with?.name,
    "verification-hydration-node-${{ matrix.node }}",
  );
  assert.equal(hydrationUpload?.with?.overwrite, true);
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
  for (const job of [
    repository,
    packageJob,
    unit,
    browser,
    hydration,
    native,
  ]) {
    assertFullHistoryCheckout(job);
    const setupNode = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(setupNode?.with?.cache, "npm");
    assert.ok(job.steps.some((step) => step.run === "npm ci"));
  }
  for (const job of [packageJob, unit, browser, hydration]) {
    assert.equal(
      job.steps.some(
        (step) => step.name === "Read baseline dependency lockfile",
      ),
      false,
    );
    const setupNode = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    assert.equal(
      setupNode?.with?.["cache-dependency-path"],
      "package-lock.json",
    );
  }
  for (const [job, suite] of [
    [unit, "unit"],
    [browser, "browser"],
    [hydration, "hydration"],
  ] as const) {
    const installIndex = job.steps.findIndex((step) => step.run === "npm ci");
    const chromiumIndex = job.steps.findIndex((step) =>
      step.run?.includes("playwright install --with-deps chromium"),
    );
    const suiteIndex = job.steps.findIndex((step) =>
      step.run?.includes(`cargo xtask check --suite ${suite}`),
    );
    assert.ok(installIndex >= 0 && installIndex < suiteIndex);
    if (suite === "browser" || suite === "hydration")
      assert.ok(chromiumIndex >= 0 && chromiumIndex < suiteIndex);
    const commands = job.steps.map((step) => step.run ?? "").join("\n");
    assert.doesNotMatch(
      commands,
      /git merge-base HEAD origin\/main/u,
      `${suite} must not resolve its cache input from origin/main`,
    );
    assert.doesNotMatch(
      commands,
      /(?:branch-point|baseline-package-lock|git show [^\n]*package-lock\.json)/u,
      `${suite} must use the checked-out lockfile`,
    );
  }
  assert.doesNotMatch(source, /origin\/main/u);
  assert.doesNotMatch(source, /baseline-package-lock/u);
  assert.equal(setupNodeVersion(repository), 24);
  assert.equal(setupNodeVersion(native), minimumTestedNode);
  assert.equal(
    setupNodeVersion(required),
    "${{ needs.repository.outputs.node-24-version }}",
  );
  assertPinnedActions(workflow);
});

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

function setupNodeVersion(job: WorkflowJob): unknown {
  return job.steps.find((step) => step.uses?.startsWith("actions/setup-node@"))
    ?.with?.["node-version"];
}
