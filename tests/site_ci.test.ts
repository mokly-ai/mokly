import assert from "node:assert/strict";
import test from "node:test";

import {
  readWorkflow,
  runWorkflowShell,
  workflowStep,
} from "./helpers/workflow.js";

const ci = await readWorkflow("ci.yml");

test("Lighthouse runs on Node 24 with Chromium and retains a failing budget report", async (t) => {
  const job = ci.jobs["site-lighthouse"];
  assert.ok(job);
  assert.equal(job["continue-on-error"], false);
  assert.equal(job["runs-on"], "ubuntu-latest");
  assert.equal(workflowStep(job, "Set up Node.js").with?.["node-version"], 24);
  assert.equal(
    workflowStep(job, "Set up npm").run,
    "npm install --global npm@11.7.0",
  );
  assert.equal(workflowStep(job, "Install dependencies").run, "npm ci");
  assert.equal(
    workflowStep(job, "Install Lighthouse dependencies").run,
    "npm ci --prefix site/lighthouse --engine-strict",
  );
  assert.equal(
    workflowStep(job, "Audit Lighthouse dependencies").run,
    "npm audit --prefix site/lighthouse --audit-level=low --include=prod --include=dev --include=optional --include=peer",
  );
  assert.equal(
    workflowStep(job, "Build Lighthouse runner").run,
    "npm run build --prefix site/lighthouse",
  );
  assert.equal(
    workflowStep(job, "Install Chromium").run,
    "npx playwright install --with-deps chromium",
  );
  assert.match(
    workflowStep(job, "Select Chromium for Lighthouse").run!,
    /CHROME_PATH=.*chromium.executablePath\(\)/,
  );
  assert.equal(
    workflowStep(job, "Build site and catalogue").run,
    "npm run build && npm run example:build && npm run site:build",
  );
  const budget = workflowStep(job, "Run Lighthouse budget");
  assert.equal(budget["continue-on-error"] ?? false, false);
  assert.equal(budget.shell, "bash");
  const result = await runWorkflowShell(
    `npm() { echo 'site:lighthouse / at 390px scored 0.90 for performance' >&2; return 1; }\n${budget.run}`,
  );
  t.after(result.dispose);
  assert.equal(result.code, 1, "tee must not hide the budget failure");
  assert.match(
    await result.rootFiles("test-results/site-lighthouse/report.txt"),
    /scored 0.90/,
  );
  const evidence = workflowStep(job, "Retain Lighthouse failure evidence");
  assert.equal(evidence.if, "failure()");
  assert.equal(evidence.with?.path, "test-results/site-lighthouse/");
});

test("Required CI enforces deterministic jobs independently of Lighthouse", async (t) => {
  const required = ci.jobs.required!;
  assert.equal(required.name, "Required CI");
  assert.equal(required.if, "always()");
  assert.deepEqual(required.needs, [
    "minimum-runtime",
    "release-runtime",
    "export-platforms",
  ]);
  const step = workflowStep(required, "Require every verification job");
  assert.deepEqual(step.env, {
    MINIMUM_RESULT: "${{ needs.minimum-runtime.result }}",
    RELEASE_RESULT: "${{ needs.release-runtime.result }}",
    EXPORT_PLATFORMS_RESULT: "${{ needs.export-platforms.result }}",
  });
  assert.doesNotMatch(step.run!, /LIGHTHOUSE/);
  const passing = Object.fromEntries(
    Object.keys(step.env!).map((key) => [key, "success"]),
  );
  for (const key of Object.keys(passing)) {
    for (const status of ["failure", "cancelled", "skipped"]) {
      const result = await runWorkflowShell(step.run!, {
        ...passing,
        [key]: status,
      });
      t.after(result.dispose);
      assert.equal(result.code, 1, `${key}=${status}`);
    }
  }
  for (const status of ["success", "failure", "cancelled", "skipped"]) {
    const result = await runWorkflowShell(step.run!, {
      ...passing,
      SITE_LIGHTHOUSE_RESULT: status,
    });
    t.after(result.dispose);
    assert.equal(
      result.code,
      0,
      `Lighthouse ${status} cannot block Required CI`,
    );
  }
});

test("only the Lighthouse job installs the isolated audit tools", () => {
  assert.equal(
    workflowStep(ci.jobs["minimum-runtime"]!, "Install dependencies").run,
    "npm ci --engine-strict",
  );
  for (const [name, job] of Object.entries(ci.jobs)) {
    if (name === "site-lighthouse") continue;
    assert.ok(
      job.steps.every((step) => !step.run?.includes("site/lighthouse")),
      name,
    );
  }
});
