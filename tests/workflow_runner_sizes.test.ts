import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface WorkflowJob {
  "runs-on"?: unknown;
  strategy?: {
    matrix?: Readonly<Record<string, unknown>>;
  };
}

interface Workflow {
  jobs?: Readonly<Record<string, WorkflowJob>>;
}

test("workflows use the smallest Blacksmith runner tiers", async () => {
  const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
  const workflowNames = (await fs.readdir(workflowsDirectory)).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  );
  assert.ok(workflowNames.length > 0);

  for (const workflowName of workflowNames) {
    const source = await fs.readFile(
      path.join(workflowsDirectory, workflowName),
      "utf8",
    );
    const workflow = parse(source) as Workflow;
    assert.ok(workflow.jobs, `${workflowName} must define jobs`);

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const context = `${workflowName}:${jobName}`;
      const runsOn = job["runs-on"];
      assert.ok(typeof runsOn === "string", `${context} runner`);
      const matrixReference = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/.exec(runsOn);
      if (!matrixReference) {
        assertMinimumRunner(runsOn, context);
        continue;
      }

      const values = job.strategy?.matrix?.[matrixReference[1]!];
      assert.ok(Array.isArray(values), `${context} runner matrix`);
      for (const value of values) {
        assert.ok(typeof value === "string", `${context} runner matrix value`);
        assertMinimumRunner(value, context);
      }
    }
  }
});

function assertMinimumRunner(label: string, context: string): void {
  const match = /^blacksmith-(\d+)vcpu-(.+)$/.exec(label);
  assert.ok(match, `${context} must use a sized Blacksmith runner`);
  const expected = match[2]!.startsWith("macos-") ? 6 : 2;
  assert.equal(
    Number(match[1]),
    expected,
    `${context} must use the smallest ${match[2]} runner`,
  );
}
