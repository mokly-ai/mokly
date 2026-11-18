import assert from "node:assert/strict";
import test from "node:test";

import {
  allowsPullRequest,
  readWorkflow,
  runWorkflowShell,
  workflowStep,
} from "./helpers/workflow.js";

const site = await readWorkflow("site.yml");
const ci = await readWorkflow("ci.yml");
const desktop = await readWorkflow("desktop-release.yml");

test("close cleanup checks out the default ref after the PR head is deleted", () => {
  const checkout = workflowStep(site.jobs["close-pr"]!, "Check out repository");
  assert.equal(checkout.with?.ref, undefined);
  assert.equal(checkout.with?.["persist-credentials"], false);
  assert.equal(
    workflowStep(site.jobs["deploy-pr"]!, "Check out repository").with?.ref,
    "${{ github.event.pull_request.head.sha }}",
  );
});

test("site and CI actions use immutable reviewed pins and isolate secrets", () => {
  const approved = new Set([
    "useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a",
    "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
    "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
    "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    "Swatinem/rust-cache@d1527c8f67ef9af357290475d4af4b0fab8f12e0",
    "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
    "actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    "actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830",
    "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    "dtolnay/rust-toolchain@6bed0761d98439e5a578e2877258200ad565ba87",
    "Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6",
    "google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093",
    "google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db",
  ]);
  for (const workflow of [site, ci, desktop]) {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) {
        if (!step.uses) continue;
        assert.match(step.uses, /@[a-f0-9]{40}$/);
        assert.ok(approved.has(step.uses), step.uses);
      }
    }
  }
  assertSecretsOnlyInEnv(site);
  assertSecretsOnlyInEnv(desktop);
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

test("site events and guards exclude forks and release pull requests", () => {
  assert.deepEqual(site.on, {
    push: { branches: ["main"] },
    pull_request: { types: ["opened", "synchronize", "reopened", "closed"] },
  });
  assert.deepEqual(site.permissions, {
    contents: "read",
  });
  assert.deepEqual(site.concurrency, {
    group: "site-${{ github.event.pull_request.number || github.ref }}",
    "cancel-in-progress": true,
  });
  assert.equal(
    site.jobs["deploy-main"]?.if,
    "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (github.event_name == 'push')",
  );
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

test("deployments derive origins and build mockups before the site", () => {
  assert.equal(site.env?.CLOUDFLARE_PROJECT_NAME, "mokly-site");
  assert.equal(site.env?.MOKLY_COMMENT_MARKER, "<!-- mokly-site -->");
  assert.equal(
    site.env?.SITE_STAGE_PR,
    "${{ vars.SITE_STAGE_PR || 'sydney-v1' }}",
  );
  assert.equal(
    site.jobs["deploy-main"]?.env?.SITE_ORIGIN,
    "https://${{ vars.MKC_DOMAIN }}",
  );
  assert.equal(
    site.jobs["deploy-pr"]?.env?.SITE_ORIGIN,
    "https://pr-${{ github.event.pull_request.number }}.mokly-site.pages.dev",
  );
  for (const name of ["deploy-main", "deploy-pr"]) {
    const job = site.jobs[name]!;
    assert.equal(job["runs-on"], "ubuntu-24.04");
    assert.equal(
      workflowStep(job, "Set up Node.js").with?.["node-version-file"],
      ".nvmrc",
    );
    assert.equal(
      workflowStep(job, "Set up Node.js").with?.["cache-dependency-path"],
      "package-lock.json",
    );
    assert.equal(
      workflowStep(job, "Set up npm").run,
      "npm install --global npm@11.21.0",
    );
    const install = workflowStep(job, "Install dependencies");
    assert.equal(install.run, "npm ci");
    const build = workflowStep(job, "Build mockups and site");
    assert.equal(
      build.run,
      "npm run mockups:build --workspace @mokly-cloud/mockups\n" +
        "npm run site:build\n",
    );
    const deploy = job.steps.find((step) =>
      step.run?.includes("wrangler pages deploy"),
    );
    assert.ok(deploy);
    assert.equal(deploy["working-directory"], "apps/site");
    assert.ok(job.steps.indexOf(install) < job.steps.indexOf(build));
    assert.ok(job.steps.indexOf(build) < job.steps.indexOf(deploy));
    assert.match(deploy.run!, /npx --no-install wrangler pages deploy dist/);
    assert.match(deploy.run!, /--project-name "\$\{CLOUDFLARE_PROJECT_NAME\}"/);
    assert.match(
      deploy.run!,
      name === "deploy-main" ? /--branch main/ : /branch="\$PREVIEW_BRANCH"/,
    );
  }
});

test("missing deployment settings fail before build with an annotation", async (t) => {
  const configured = {
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    CLOUDFLARE_API_TOKEN: "test-token",
    CLOUDFLARE_PROJECT_NAME: "mokly-site",
    MKC_DOMAIN: "example.com",
    SITE_ORIGIN: "https://example.com",
    SITE_STAGE_PR: "sydney-v1",
  };
  for (const name of ["deploy-main", "deploy-pr"]) {
    const step = workflowStep(
      site.jobs[name]!,
      "Validate deployment configuration",
    );
    for (const setting of Object.keys(configured)) {
      const result = await runWorkflowShell(step.run!, {
        ...configured,
        [setting]: "",
      });
      t.after(result.dispose);
      assert.equal(result.code, 1, `${name} accepted empty ${setting}`);
      assert.match(result.output, /::error/);
      assert.ok(result.output.includes(setting));
      assert.ok(!result.output.includes("test-token"));
    }
    const result = await runWorkflowShell(step.run!, configured);
    t.after(result.dispose);
    assert.equal(result.code, 0);
  }
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
