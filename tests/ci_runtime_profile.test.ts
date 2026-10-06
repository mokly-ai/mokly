import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
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
const [, currentTestedNode] = TESTED_NODE_VERSIONS;
const selectedNodeMatrix =
  "${{ fromJSON(needs.repository.outputs.node-matrix) }}";

interface WorkflowStep {
  env?: Readonly<Record<string, string>>;
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  needs?: readonly string[];
  outputs?: Readonly<Record<string, string>>;
  steps: readonly WorkflowStep[];
  strategy?: {
    matrix: Readonly<Record<string, readonly (string | number)[] | string>>;
  };
}

interface Workflow {
  env: Readonly<Record<string, string>>;
  jobs: Readonly<Record<string, WorkflowJob>>;
}

test("CI selects the release runtime profile only for trusted release PRs", async (context) => {
  const workflow = await readWorkflow();
  const repository = workflow.jobs.repository;
  assert.ok(repository);
  const selector = repository.steps.find(
    (step) => step.name === "Select Node verification profile",
  );
  assert.ok(selector?.id);
  assert.ok(selector.run);
  const detection = selector.env?.RELEASE_PULL_REQUEST;
  assert.match(String(detection), /github\.event_name == 'pull_request'/);
  assert.match(
    String(detection),
    /head\.repo\.full_name == github\.repository/,
  );
  assert.match(String(detection), /startsWith\(.+release-please--/);
  assert.match(String(detection), /autorelease:/);
  assert.equal(
    repository.outputs?.["node-matrix"],
    `\${{ steps.${selector.id}.outputs.node-matrix }}`,
  );
  assert.equal(
    repository.outputs?.["verification-runtimes"],
    `\${{ steps.${selector.id}.outputs.verification-runtimes }}`,
  );

  for (const profile of [
    {
      release: false,
      matrix: '["22.14.0"]',
      runtimes: "node-22.14.0",
    },
    {
      release: true,
      matrix: '["22.14.0","24"]',
      runtimes: "node-22.14.0,node-24",
    },
  ]) {
    await context.test(profile.release ? "release" : "ordinary", async () => {
      const output = await runSelector(selector.run!, profile.release);
      assert.equal(output["node-matrix"], profile.matrix);
      assert.equal(output["verification-runtimes"], profile.runtimes);
    });
  }
});

test("selected runtimes drive every functional matrix and Required CI", async () => {
  const workflow = await readWorkflow();
  for (const name of ["package", "unit", "browser", "hydration"] as const) {
    const job = workflow.jobs[name];
    assert.ok(job, name);
    assert.equal(job.strategy?.matrix.node, selectedNodeMatrix, name);
  }

  const required = workflow.jobs.required;
  assert.ok(required);
  const aggregate = required.steps.find((step) =>
    step.run?.includes("scripts/verification/aggregate.mjs"),
  );
  assert.equal(
    aggregate?.env?.EXPECTED_RUNTIMES,
    "${{ needs.repository.outputs.verification-runtimes }}",
  );
  assert.match(String(aggregate?.run), /--runtimes "\$EXPECTED_RUNTIMES"/);
});

test("local, package and CI runtimes share the Node compatibility policy", async () => {
  const [version, manifestSource, lockSource, readme] = await Promise.all([
    fs.readFile(path.join(repositoryRoot, ".nvmrc"), "utf8"),
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
    readme.includes("[`.nvmrc`](./.nvmrc)"),
    "development setup must follow the tested Node version",
  );
  assert.ok(TESTED_NODE_VERSIONS.every(isSupportedNodeVersion));
  assert.ok(testedNodeVersions.includes(version.trim()));
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
  for (const name of ["package", "unit", "browser", "hydration", "required"]) {
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

async function readWorkflow(): Promise<Workflow> {
  return parse(await workflowSource()) as Workflow;
}

async function workflowSource(): Promise<string> {
  return await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
}

async function runSelector(
  script: string,
  release: boolean,
): Promise<Readonly<Record<string, string>>> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-ci-profile-"));
  const outputPath = path.join(root, "output");
  try {
    await execute(
      "bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputPath,
          RELEASE_PULL_REQUEST: String(release),
        },
      },
    );
    const output = await fs.readFile(outputPath, "utf8");
    return Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => line.split("=", 2) as [string, string]),
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}
