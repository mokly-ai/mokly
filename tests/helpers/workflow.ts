import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";

import { parse } from "yaml";

import { repositoryRoot } from "./fixture.js";

export interface WorkflowStep {
  "continue-on-error"?: boolean;
  env?: Record<string, string>;
  id?: string;
  if?: string;
  name?: string;
  run?: string;
  shell?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

export interface WorkflowJob {
  "continue-on-error"?: boolean;
  env?: Record<string, string>;
  if?: string;
  name?: string;
  needs?: string[];
  "runs-on": string;
  steps: WorkflowStep[];
}

export interface Workflow {
  concurrency: { group: string; "cancel-in-progress": boolean };
  env?: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
}

export async function readWorkflow(name: string): Promise<Workflow> {
  return parse(
    await readFile(
      path.join(repositoryRoot, ".github/workflows", name),
      "utf8",
    ),
  ) as Workflow;
}

export function workflowStep(job: WorkflowJob, name: string): WorkflowStep {
  const step = job.steps.find((candidate) => candidate.name === name);
  assert.ok(step, `Missing step: ${name}`);
  return step;
}

export function allowsPullRequest(
  job: WorkflowJob,
  options: {
    action?: string;
    branch?: string;
    fork?: boolean;
    labels?: string[];
  } = {},
): boolean {
  assert.ok(job.if);
  const expression = job.if.replaceAll(
    "github.event.pull_request.labels.*.name",
    "github.event.pull_request.labels.map(label => label.name)",
  );
  return runInNewContext(expression, {
    contains: (value: string, part: string) => value.includes(part),
    github: {
      event: {
        action: options.action ?? "opened",
        pull_request: {
          head: {
            ref: options.branch ?? "feature/site",
            repo: {
              full_name: options.fork ? "contributor/mokly" : "mokly-ai/mokly",
            },
          },
          labels: (options.labels ?? []).map((name) => ({ name })),
        },
      },
      event_name: "pull_request",
      repository: "mokly-ai/mokly",
    },
    join: (values: string[], separator: string) => values.join(separator),
    startsWith: (value: string, prefix: string) => value.startsWith(prefix),
  }) as boolean;
}

export async function runWorkflowShell(
  script: string,
  environment: Record<string, string> = {},
  setup: (root: string) => Promise<void> = async () => {},
): Promise<{
  code: number | null;
  output: string;
  rootFiles: (name: string) => Promise<string>;
  dispose: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-site-workflow-"));
  await writeFile(path.join(root, "output"), "");
  await setup(root);
  const result = spawnSync(
    "bash",
    ["--noprofile", "--norc", "-eo", "pipefail", "-c", script],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        GITHUB_OUTPUT: path.join(root, "output"),
        TMPDIR: root,
        ...environment,
      },
      timeout: 10_000,
    },
  );
  assert.ifError(result.error);
  return {
    code: result.status,
    dispose: () => rm(root, { force: true, recursive: true }),
    output: result.stdout + result.stderr,
    rootFiles: (name) => readFile(path.join(root, name), "utf8"),
  };
}
