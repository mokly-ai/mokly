import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  shell?: string;
  "continue-on-error"?: boolean;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

interface Workflow {
  on: { schedule: { cron: string }[]; workflow_dispatch: unknown };
  permissions: Record<string, string>;
  concurrency: { group: string; "cancel-in-progress": boolean };
  jobs: Record<
    string,
    {
      "runs-on": string;
      "timeout-minutes": number;
      permissions: Record<string, string>;
      steps: WorkflowStep[];
    }
  >;
}

test("scheduled strict audit maintains one update branch without installing first", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/dependency-audit.yml"),
    "utf8",
  );
  const workflow = parse(source) as Workflow;
  assert.deepEqual(Object.keys(workflow.on).sort(), [
    "schedule",
    "workflow_dispatch",
  ]);
  assert.equal(workflow.on.schedule.length, 1);
  const cron = workflow.on.schedule[0]!.cron.split(" ");
  assert.equal(cron.length, 5);
  assert.match(cron[0]!, /^\d+$/u);
  assert.ok(![0, 30].includes(Number(cron[0])));
  assert.ok(Number(cron[0]) < 60);
  assert.deepEqual(cron.slice(2), ["*", "*", "*"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.concurrency, {
    group: "dependency-audit",
    "cancel-in-progress": false,
  });
  assert.equal(Object.keys(workflow.jobs).length, 1);
  const job = Object.values(workflow.jobs)[0]!;
  assert.equal(job["runs-on"], "blacksmith-2vcpu-ubuntu-2404");
  assert.equal(job["timeout-minutes"], 30);
  assert.deepEqual(job.permissions, {
    contents: "write",
    "pull-requests": "write",
    issues: "write",
  });
  const token = "${{ secrets.DEPENDENCY_AUDIT_TOKEN || github.token }}";
  const checkout = job.steps[0]!;
  const node = job.steps[1]!;
  assert.equal(
    checkout.uses,
    "useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a",
  );
  assert.deepEqual(checkout.with, { ref: "main", "fetch-depth": 0, token });
  assert.equal(
    node.uses,
    "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
  );
  assert.deepEqual(node.with, {
    "node-version": 24,
    "package-manager-cache": false,
  });
  assert.equal(job.steps[2]?.run, "npm install --global npm@11.21.0");
  const audit = job.steps[3]!;
  assert.ok(audit.id);
  assert.equal(audit.shell, "bash");
  assert.equal(audit["continue-on-error"], true);
  assert.equal(
    audit.run?.trim(),
    [
      "mkdir -p .context",
      "npm run dependencies:check -- --report .context/dependency-audit.json 2>&1 | tee .context/dependency-audit.log",
    ].join("\n"),
  );
  assert.doesNotMatch(audit.run ?? "", /--baseline/u);
  const update = job.steps[4]!;
  assert.equal(
    update.run,
    'node scripts/verification/dependency-audit-pr.mjs --outcome "$AUDIT_OUTCOME" --log .context/dependency-audit.log --report .context/dependency-audit.json',
  );
  assert.deepEqual(update.env, {
    AUDIT_OUTCOME: `\${{ steps.${audit.id}.outcome }}`,
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: "${{ github.repository }}",
    GITHUB_SERVER_URL: "${{ github.server_url }}",
    GITHUB_RUN_ID: "${{ github.run_id }}",
  });
  assert.equal(job.steps.length, 5);
  assert.doesNotMatch(source, /npm ci/u);
  for (const step of job.steps) assert.doesNotMatch(step.run ?? "", /\$\{\{/u);
});
