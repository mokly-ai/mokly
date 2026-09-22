import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import {
  SUPPORTED_NODE_RANGE,
  TESTED_NODE_VERSIONS,
  isSupportedNodeVersion,
} from "../dist/cli/bootstrap.js";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const testedNodeVersions: readonly string[] = TESTED_NODE_VERSIONS;
const [minimumTestedNode, currentTestedNode] = TESTED_NODE_VERSIONS;
const resultVariables = [
  "REPOSITORY_RESULT",
  "PACKAGE_RESULT",
  "UNIT_RESULT",
  "BROWSER_RESULT",
  "NATIVE_RESULT",
] as const;

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
    matrix: Readonly<Record<string, readonly (string | number)[]>>;
  };
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
  assert.deepEqual(packageJob.strategy?.matrix.node, TESTED_NODE_VERSIONS);
  for (const job of [unit, browser]) {
    assert.equal(job.strategy?.["fail-fast"], false);
    assert.deepEqual(job.strategy?.matrix.node, TESTED_NODE_VERSIONS);
    assert.deepEqual(job.strategy?.matrix.shard, [1, 2, 3, 4]);
  }
  assert.equal(native.strategy?.["fail-fast"], false);
  assert.deepEqual(native.strategy?.matrix.os, [
    "macos-latest",
    "windows-latest",
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
  assert.equal(setupNodeVersion(repository), currentTestedNode);
  assert.equal(setupNodeVersion(native), minimumTestedNode);
  assert.equal(setupNodeVersion(required), currentTestedNode);
  assertPinnedActions(workflow);
});

test("local, package and CI runtimes share the Node compatibility policy", async () => {
  const [version, manifestSource, lockSource, readme] = await Promise.all([
    fs.readFile(path.join(repositoryRoot, ".node-version"), "utf8"),
    fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    fs.readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
    fs.readFile(path.join(repositoryRoot, "README.md"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource) as {
    engines: { node: string };
  };
  const lock = JSON.parse(lockSource) as {
    packages: { "": { engines: { node: string } } };
  };
  assert.equal(version.trim(), currentTestedNode);
  assert.equal(manifest.engines.node, SUPPORTED_NODE_RANGE);
  assert.equal(lock.packages[""].engines.node, manifest.engines.node);
  assert.ok(
    readme.includes(`\`${SUPPORTED_NODE_RANGE}\``),
    "the README must document the supported Node range",
  );
  assert.ok(
    readme.includes("[`.node-version`](./.node-version)"),
    "development setup must follow the tested Node version",
  );
  assert.ok(TESTED_NODE_VERSIONS.every(isSupportedNodeVersion));
  assert.ok(testedNodeVersions.includes(version.trim()));
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
    step.uses?.startsWith("actions/checkout@"),
  );
  assert.ok(checkout);
  assert.equal(checkout.with?.["fetch-depth"], 0);
}

function setupNodeVersion(job: WorkflowJob): unknown {
  return job.steps.find((step) => step.uses?.startsWith("actions/setup-node@"))
    ?.with?.["node-version"];
}
