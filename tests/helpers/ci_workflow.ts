/** Shared CI workflow types, reader, and contract assertions. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

interface WorkflowStep {
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

/** One parsed CI job. */
export interface WorkflowJob {
  if?: string;
  name?: string;
  needs?: readonly string[];
  outputs?: Readonly<Record<string, string>>;
  steps: readonly WorkflowStep[];
  strategy?: {
    "fail-fast"?: boolean;
    matrix: Readonly<Record<string, readonly (string | number)[] | string>>;
  };
  "timeout-minutes"?: number;
}

/** Parsed repository CI workflow contract. */
export interface Workflow {
  concurrency: { "cancel-in-progress": boolean };
  env: Readonly<Record<string, string>>;
  jobs: Readonly<Record<string, WorkflowJob>>;
  on: Readonly<Record<string, unknown>>;
  permissions: Readonly<Record<string, string>>;
}

/** Read or verify the workflow contract. */
export async function workflowSource(): Promise<string> {
  return await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
}

/** Read or verify the workflow contract. */
export function assertPinnedActions(workflow: Workflow): void {
  const actions = Object.values(workflow.jobs).flatMap((job) =>
    job.steps.flatMap((step) => (step.uses ? [step.uses] : [])),
  );
  assert.ok(actions.length > 0);
  for (const action of actions) assert.match(action, /@[a-f0-9]{40}$/);
}

/** Read or verify the workflow contract. */
export function assertFullHistoryCheckout(job: WorkflowJob): void {
  const checkout = job.steps.find((step) =>
    step.uses?.startsWith("useblacksmith/checkout@"),
  );
  assert.ok(checkout);
  assert.equal(checkout.with?.["fetch-depth"], 0);
}

/** Read or verify the workflow contract. */
export function setupNodeVersion(job: WorkflowJob): unknown {
  return job.steps.find((step) => step.uses?.startsWith("actions/setup-node@"))
    ?.with?.["node-version"];
}
