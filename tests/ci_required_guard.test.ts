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
  "PREPARE_RESULT",
  "PACKAGE_RESULT",
  "UNIT_RESULT",
  "BROWSER_RESULT",
  "HYDRATION_RESULT",
  "NATIVE_RESULT",
] as const;

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowJob {
  steps: readonly WorkflowStep[];
}

interface Workflow {
  jobs: Readonly<Record<string, WorkflowJob>>;
}

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
