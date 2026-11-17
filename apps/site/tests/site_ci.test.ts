import assert from "node:assert/strict";
import test from "node:test";

import {
  readWorkflow,
  runRepositoryWorkflowShell,
  runWorkflowShell,
  workflowStep,
} from "./helpers/workflow.js";

const ci = await readWorkflow("ci.yml");

test("Lighthouse uses the workspace tools and retains a failing report", async (t) => {
  const job = ci.jobs["site-lighthouse"];
  assert.ok(job);
  assert.equal(job["continue-on-error"], false);
  assert.equal(job["runs-on"], "blacksmith-2vcpu-ubuntu-2404");
  assert.equal(
    workflowStep(job, "Set up Node.js").with?.["node-version-file"],
    ".nvmrc",
  );
  assert.equal(
    workflowStep(job, "Set up npm").run,
    "npm install --global npm@11.11.0",
  );
  assert.equal(workflowStep(job, "Install dependencies").run, "npm ci");
  assert.equal(
    workflowStep(job, "Install Chromium").run,
    "npm exec --workspace @mokly-cloud/site -- playwright install --with-deps chromium",
  );
  const selection = await runRepositoryWorkflowShell(
    workflowStep(job, "Select Chromium for Lighthouse"),
  );
  t.after(selection.dispose);
  assert.equal(selection.code, 0, selection.output);
  assert.match(
    await selection.rootFiles("environment"),
    /^CHROME_PATH=\/.*chromium/m,
  );
  assert.equal(
    workflowStep(job, "Build mockups and site").run,
    "npm run mockups:build --workspace @mokly-cloud/mockups\n" +
      "npm run site:build\n",
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

test("required CI remains independent of report-only Lighthouse", async (t) => {
  const required = ci.jobs.required!;
  assert.equal(required.name, "required");
  assert.equal(required.if, "${{ always() }}");
  assert.deepEqual(required.needs, ["check", "images", "plan"]);
  const step = workflowStep(required, "Require every check to pass");
  assert.deepEqual(step.env, {
    CHECK_RESULT: "${{ needs.check.result }}",
    IMAGE_RESULT: "${{ needs.images.result }}",
    PLAN_RESULT: "${{ needs.plan.result }}",
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
      `Lighthouse ${status} cannot block required CI`,
    );
  }
});

test("Lighthouse has no nested install or lockfile", () => {
  const job = ci.jobs["site-lighthouse"]!;
  for (const step of job.steps) {
    assert.doesNotMatch(
      step.run ?? "",
      /site\/lighthouse|npm ci --prefix site/,
    );
  }
});
