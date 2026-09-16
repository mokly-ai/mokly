import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  allowsPullRequest,
  readWorkflow,
  runWorkflowShell,
  workflowStep,
} from "./helpers/workflow.js";

const site = await readWorkflow("site.yml");
const ci = await readWorkflow("ci.yml");

test("close cleanup checks out the default ref even after the PR head is deleted", () => {
  const checkout = workflowStep(site.jobs["close-pr"]!, "Check out repository");
  assert.equal(checkout.with?.ref, undefined);
  assert.equal(checkout.with?.["persist-credentials"], false);
  assert.equal(
    workflowStep(site.jobs["deploy-pr"]!, "Check out repository").with?.ref,
    "${{ github.event.pull_request.head.sha }}",
  );
});

test("site and CI actions reuse immutable reviewed pins and secrets appear only in env", async () => {
  const preview = await readWorkflow("preview.yml");
  const approved = new Set([
    ...Object.values(preview.jobs).flatMap((job) =>
      job.steps.map((step) => step.uses),
    ),
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  ]);
  for (const workflow of [site, ci]) {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (!step.uses) continue;
        assert.match(step.uses, /@[a-f0-9]{40}$/);
        assert.ok(approved.has(step.uses), step.uses);
      }
    }
    assertSecretsOnlyInEnv(workflow);
  }
  const credentialSteps = Object.values(site.jobs).flatMap((job) =>
    job.steps.filter((step) => step.env?.CLOUDFLARE_API_TOKEN),
  );
  assert.equal(credentialSteps.length, 5);
  for (const step of credentialSteps) {
    assert.equal(
      step.env?.CLOUDFLARE_ACCOUNT_ID,
      "${{ vars.CLOUDFLARE_ACCOUNT_ID }}",
    );
    assert.equal(
      step.env?.CLOUDFLARE_API_TOKEN,
      "${{ secrets.CLOUDFLARE_PAGES_API_TOKEN || secrets.CLOUDFLARE_API_TOKEN }}",
    );
  }
});

test("site events, concurrency and guards exclude forks and release PRs on deploy and close", () => {
  assert.deepEqual(site.on, {
    push: { branches: ["main"] },
    pull_request: { types: ["opened", "synchronize", "reopened", "closed"] },
  });
  assert.deepEqual(site.permissions, {
    contents: "read",
    "pull-requests": "write",
  });
  assert.deepEqual(site.concurrency, {
    group: "site-${{ github.event.pull_request.number || github.ref }}",
    "cancel-in-progress": true,
  });
  assert.equal(site.jobs["deploy-main"]?.if, "github.event_name == 'push'");
  for (const name of ["deploy-pr", "close-pr"]) {
    const job = site.jobs[name]!;
    const action = name === "close-pr" ? "closed" : "opened";
    assert.equal(allowsPullRequest(job, { action }), true);
    assert.equal(allowsPullRequest(job, { action, fork: true }), false);
    assert.equal(
      allowsPullRequest(job, {
        action,
        branch: "release-please--branches--main",
      }),
      false,
    );
    assert.equal(
      allowsPullRequest(job, { action, labels: ["autorelease: pending"] }),
      false,
    );
  }
  assert.equal(
    allowsPullRequest(site.jobs["deploy-pr"]!, { action: "closed" }),
    false,
  );
  assert.equal(allowsPullRequest(site.jobs["close-pr"]!), false);
});

test("deployments build the catalogue before the site with explicit origins and pinned tools", async () => {
  assert.equal(site.env?.CLOUDFLARE_PROJECT_NAME, "mokly-site");
  assert.equal(site.env?.MOKLY_COMMENT_MARKER, "<!-- mokly-site -->");
  assert.equal(site.env?.SITE_APP_ORIGIN, "${{ vars.SITE_APP_ORIGIN }}");
  assert.equal(site.env?.SITE_STAGE_PR, "${{ vars.SITE_STAGE_PR || '71' }}");
  const changelog = await readFile(
    path.join(repositoryRoot, "CHANGELOG.md"),
    "utf8",
  );
  assert.match(changelog, /\[#71\]/);
  assert.equal(
    site.jobs["deploy-main"]?.env?.SITE_ORIGIN,
    "${{ vars.SITE_ORIGIN }}",
  );
  assert.equal(
    site.jobs["deploy-pr"]?.env?.SITE_ORIGIN,
    "https://pr-${{ github.event.pull_request.number }}.mokly-site.pages.dev",
  );
  for (const name of ["deploy-main", "deploy-pr"]) {
    const job = site.jobs[name]!;
    assert.equal(
      workflowStep(job, "Set up Node.js").with?.["node-version"],
      24,
    );
    assert.equal(
      workflowStep(job, "Set up npm").run,
      "npm install --global npm@11.7.0",
    );
    const install = workflowStep(job, "Install dependencies");
    assert.equal(install.run, "npm ci");
    const build = workflowStep(job, "Build site and catalogue");
    assert.equal(
      build.run,
      "npm run build && npm run example:build && npm run site:build",
    );
    const deploy = job.steps.find((step) =>
      step.run?.includes("wrangler pages deploy"),
    );
    assert.ok(deploy);
    assert.ok(job.steps.indexOf(install) < job.steps.indexOf(build));
    assert.ok(job.steps.indexOf(build) < job.steps.indexOf(deploy));
    assert.match(
      deploy.run!,
      /npx --no-install wrangler pages deploy site\/dist/,
    );
    assert.match(deploy.run!, /--project-name "\$\{CLOUDFLARE_PROJECT_NAME\}"/);
    assert.match(
      deploy.run!,
      name === "deploy-main"
        ? /--branch main/
        : /branch="pr-\$\{\{ github.event.pull_request.number \}\}"/,
    );
  }
});

test("missing production settings fail before build with a clear annotation", async (t) => {
  const step = workflowStep(
    site.jobs["deploy-main"]!,
    "Validate deployment configuration",
  );
  const configured = {
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    CLOUDFLARE_API_TOKEN: "test-token",
    SITE_APP_ORIGIN: "https://app.example.com",
    SITE_ORIGIN: "https://example.com",
  };
  for (const setting of Object.keys(configured)) {
    const result = await runWorkflowShell(step.run!, {
      ...configured,
      [setting]: "",
    });
    t.after(result.dispose);
    assert.equal(result.code, 1);
    assert.match(result.output, /::error/);
    assert.ok(result.output.includes(setting));
    assert.ok(!result.output.includes("test-token"));
  }
  const result = await runWorkflowShell(step.run!, configured);
  t.after(result.dispose);
  assert.equal(result.code, 0);
});

function assertSecretsOnlyInEnv(value: unknown, insideEnv = false): void {
  if (typeof value === "string") {
    if (!insideEnv) assert.doesNotMatch(value, /\$\{\{[^}]*\bsecrets\b/);
  } else if (Array.isArray(value)) {
    for (const item of value) assertSecretsOnlyInEnv(item, insideEnv);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value))
      assertSecretsOnlyInEnv(item, insideEnv || key === "env");
  }
}
