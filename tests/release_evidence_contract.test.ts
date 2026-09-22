import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import {
  REQUIRED_CI_JOB_NAME,
  VERIFICATION_ARTIFACT_PATTERN,
  VERIFICATION_REPORT_COUNT,
} from "../scripts/release/evidence_contract.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

interface WorkflowStep {
  name?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  name?: string;
  steps: readonly WorkflowStep[];
  strategy?: {
    matrix: Readonly<Record<string, readonly (string | number)[]>>;
  };
}

interface Workflow {
  jobs: Readonly<Record<string, WorkflowJob>>;
}

test("release evidence constants match the CI job and artifact namespace", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
  const workflow = parse(source) as Workflow;
  assert.equal(workflow.jobs.required?.name, REQUIRED_CI_JOB_NAME);
  const download = workflow.jobs.required?.steps.find(
    (step) => step.name === "Download shard evidence",
  );
  assert.equal(download?.with?.pattern, "verification-*");
  for (const jobName of ["unit", "browser"]) {
    const upload = workflow.jobs[jobName]?.steps.find((step) =>
      step.name?.startsWith("Retain "),
    );
    assert.equal(typeof upload?.with?.name, "string");
    assert.match(String(upload?.with?.name), VERIFICATION_ARTIFACT_PATTERN);
  }
  const expectedReports = ["unit", "browser"].reduce((total, jobName) => {
    const matrix = workflow.jobs[jobName]?.strategy?.matrix;
    return total + (matrix?.node?.length ?? 0) * (matrix?.shard?.length ?? 0);
  }, 0);
  assert.equal(expectedReports, VERIFICATION_REPORT_COUNT);
});
