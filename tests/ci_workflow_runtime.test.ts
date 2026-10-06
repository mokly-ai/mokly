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

import { workflowSource, type Workflow } from "./helpers/ci_workflow.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const testedNodeVersions: readonly string[] = TESTED_NODE_VERSIONS;
const [, currentTestedNode] = TESTED_NODE_VERSIONS;
const resultVariables = [
  "REPOSITORY_RESULT",
  "PACKAGE_RESULT",
  "UNIT_RESULT",
  "BROWSER_RESULT",
  "HYDRATION_RESULT",
  "NATIVE_RESULT",
] as const;

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
