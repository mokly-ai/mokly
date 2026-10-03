import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface WorkflowStep {
  env?: Readonly<Record<string, string>>;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface Workflow {
  jobs: Readonly<
    Record<
      string,
      {
        name?: string;
        "runs-on"?: string;
        steps: readonly WorkflowStep[];
        "timeout-minutes"?: number;
      }
    >
  >;
  on: { pull_request: { types: string[] } };
  permissions: Readonly<Record<string, string>>;
}

test("pull request title workflow passes untrusted titles only through env", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/pull-request-title.yml"),
    "utf8",
  );
  const workflow = parse(source) as Workflow;
  assert.deepEqual(Object.keys(workflow.on), ["pull_request"]);
  assert.deepEqual(workflow.on.pull_request.types, [
    "opened",
    "edited",
    "reopened",
    "synchronize",
  ]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(Object.keys(workflow.jobs), ["title"]);
  const job = workflow.jobs.title;
  assert.ok(job);
  assert.equal(job.name, "Pull Request Title");
  assert.equal(job["runs-on"], "blacksmith-2vcpu-ubuntu-2404");
  assert.equal(job["timeout-minutes"], 5);
  const checkout = job.steps.find((step) =>
    step.uses?.startsWith("useblacksmith/checkout@"),
  );
  const setup = job.steps.find((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  assert.ok(checkout);
  assert.equal(setup?.with?.["node-version"], "24.21.0");
  assert.equal(setup?.with?.["package-manager-cache"], false);
  const validation = job.steps.find((step) =>
    step.run?.includes("scripts/verification/pull-request-title.mjs"),
  );
  assert.equal(
    validation?.env?.PULL_REQUEST_TITLE,
    "${{ github.event.pull_request.title }}",
  );
  assert.equal(
    validation?.run,
    "node scripts/verification/pull-request-title.mjs",
  );
  assert.equal(source.match(/github\.event\.pull_request\.title/gu)?.length, 1);
  for (const step of job.steps) {
    if (step.run) {
      assert.doesNotMatch(step.run, /pull_request\.title/u);
      assert.doesNotMatch(step.run, /\$\{\{/u);
    }
    if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/u);
  }
});
