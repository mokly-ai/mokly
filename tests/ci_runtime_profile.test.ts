import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const selectedNodeMatrix =
  "${{ fromJSON(needs.repository.outputs.node-matrix) }}";

interface WorkflowStep {
  env?: Readonly<Record<string, string>>;
  id?: string;
  name?: string;
  run?: string;
}

interface WorkflowJob {
  outputs?: Readonly<Record<string, string>>;
  steps: readonly WorkflowStep[];
  strategy?: {
    matrix: Readonly<Record<string, readonly (string | number)[] | string>>;
  };
}

interface Workflow {
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
  for (const name of ["package", "unit", "browser"] as const) {
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

async function readWorkflow(): Promise<Workflow> {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
  return parse(source) as Workflow;
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
