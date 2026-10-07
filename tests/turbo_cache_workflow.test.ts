import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseConfigFileTextToJson } from "typescript";
import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface Workflow {
  on: {
    workflow_dispatch: unknown;
    push: { branches: string[]; paths: string[] };
  };
  permissions: Record<string, string>;
  concurrency: { group: string; "cancel-in-progress": boolean };
  env: Record<string, string>;
  jobs: {
    deploy: {
      if: string;
      environment: string;
      "runs-on": string;
      "timeout-minutes": number;
      steps: {
        name: string;
        run?: string;
        uses?: string;
        env?: Record<string, string>;
      }[];
    };
  };
}

test("cache Worker deployment is main-only, credential-checked and validated before deploy", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/turbo-cache.yml"),
    "utf8",
  );
  const workflow = parse(source) as Workflow;
  assert.deepEqual(Object.keys(workflow.on).sort(), [
    "push",
    "workflow_dispatch",
  ]);
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.ok(workflow.on.push.paths.includes("scripts/turbo-cache/**"));
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.concurrency.group, "turbo-cache-worker");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.equal(workflow.env.TURBO_TELEMETRY_DISABLED, "1");
  assert.equal(workflow.env.TURBO_CACHE, "local:rw");
  const job = workflow.jobs.deploy;
  assert.equal(job.environment, "turbo-cache-deploy");
  assert.equal(
    job.if,
    "github.repository == 'mokly-ai/mokly' && github.ref == 'refs/heads/main'",
  );
  assert.equal(job["runs-on"], "blacksmith-2vcpu-ubuntu-2404");
  assert.equal(job["timeout-minutes"], 30);
  for (const step of job.steps)
    if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/u);
  const steps = job.steps.map((step) => step.name);
  const validate = job.steps.find(
    (step) => step.name === "Validate Cloudflare configuration",
  )!;
  assert.deepEqual(validate.env, {
    CLOUDFLARE_ACCOUNT_ID: "${{ vars.CLOUDFLARE_ACCOUNT_ID }}",
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_WORKERS_API_TOKEN }}",
  });
  assert.match(validate.run!, /if \[ -z "\$\{CLOUDFLARE_ACCOUNT_ID\}" \]/u);
  assert.match(validate.run!, /if \[ -z "\$\{CLOUDFLARE_API_TOKEN\}" \]/u);
  assert.match(validate.run!, /exit "\$\{missing\}"/u);
  assert.ok(
    steps.indexOf(validate.name) < steps.indexOf("Install dependencies"),
  );
  const deploy = job.steps.find((step) => step.name === "Deploy Worker")!;
  assert.equal(
    deploy.run,
    "npx --no-install wrangler deploy --config scripts/turbo-cache/wrangler.jsonc",
  );
  assert.deepEqual(deploy.env, validate.env);
  for (const name of ["Typecheck Worker", "Test Worker", "Audit dependencies"])
    assert.ok(steps.indexOf(name) < steps.indexOf(deploy.name));
  assert.equal(
    job.steps.find((step) => step.name === "Typecheck Worker")!.run,
    "npm run typecheck:turbo-cache",
  );
  assert.equal(
    job.steps.find((step) => step.name === "Test Worker")!.run,
    "node --import tsx --test tests/turbo_cache_*.test.ts",
  );
  assert.equal(
    job.steps.find((step) => step.name === "Install npm")!.run,
    "npm install --global npm@11.21.0",
  );
});

test("cache bindings stay local in development and client origin is configured", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, "scripts/turbo-cache/wrangler.jsonc"),
    "utf8",
  );
  const parsed = parseConfigFileTextToJson("wrangler.jsonc", source);
  assert.equal(parsed.error, undefined);
  const config = parsed.config as {
    name: string;
    main: string;
    compatibility_date: string;
    preview_urls: boolean;
    r2_buckets: { binding: string; bucket_name: string; remote: boolean }[];
  };
  assert.equal(config.name, "mokly-turbo-cache");
  assert.equal(config.main, "worker.ts");
  assert.equal(config.compatibility_date, "2026-07-21");
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.r2_buckets, [
    { binding: "ARTIFACTS", bucket_name: "mokly-turbo-cache", remote: false },
  ]);
  const turbo = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "turbo.json"), "utf8"),
  ) as {
    agentGuidance: boolean;
    remoteCache: { apiUrl?: string; teamSlug?: string; teamId?: string };
  };
  assert.equal(turbo.agentGuidance, false);
  assert.equal(
    turbo.remoteCache.apiUrl,
    "https://mokly-turbo-cache.calum-785.workers.dev",
  );
  assert.equal(new URL(turbo.remoteCache.apiUrl!).pathname, "/");
  assert.ok(!turbo.remoteCache.apiUrl!.endsWith("/"));
  assert.equal(turbo.remoteCache.teamSlug, "mokly");
  assert.equal(turbo.remoteCache.teamId, undefined);
});

test("the Worker contract lists all modules and copies its exact Wrangler config", async () => {
  const workerRoot = path.join(repositoryRoot, "scripts/turbo-cache");
  const config = await fs.readFile(
    path.join(workerRoot, "wrangler.jsonc"),
    "utf8",
  );
  const contract = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/ci-remote-cache-worker.md"),
    "utf8",
  );
  const moduleList = contract.slice(
    contract.indexOf("Own the modules under"),
    contract.indexOf("```json", contract.indexOf("Own the modules under")),
  );
  const plan = await fs.readFile(
    path.join(repositoryRoot, "plans/turborepo-cloudflare-remote-cache.md"),
    "utf8",
  );
  const planModules = plan.slice(
    plan.indexOf("Repository layout:"),
    plan.indexOf("## CI Wiring"),
  );
  for (const module of (await fs.readdir(workerRoot)).filter((file) =>
    file.endsWith(".ts"),
  )) {
    assert.ok(moduleList.includes(`\`${module}\``), module);
    assert.ok(planModules.includes(module), module);
  }
  const documented = /```jsonc\n([\s\S]*?)\n```/u.exec(contract)?.[1];
  assert.equal(documented?.trim(), config.trim());
});
