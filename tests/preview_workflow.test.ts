import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { prepareHosting } from "../scripts/preview/hosting.mjs";

interface Step {
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}
interface Job {
  if?: string;
  permissions?: Record<string, string>;
  steps: Step[];
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  "timeout-minutes"?: number;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency: { "cancel-in-progress": boolean };
  jobs: Record<string, Job>;
  env?: Record<string, string>;
}
async function workflow(): Promise<Workflow> {
  return parse(
    await fs.readFile(".github/workflows/preview.yml", "utf8"),
  ) as Workflow;
}

function allowed(
  condition: string,
  event: string,
  action: string,
  fork: boolean,
  release: boolean,
): boolean {
  const github = {
    event_name: event,
    repository: "owner/repo",
    event: {
      action,
      pull_request: {
        head: {
          repo: { full_name: fork ? "fork/repo" : "owner/repo" },
          ref: release ? "release-please--main" : "feature",
        },
        labels: [],
      },
    },
  };
  const expression = condition.replace(
    "github.event.pull_request.labels.*.name",
    "[]",
  );
  return Boolean(
    Function(
      "github",
      "startsWith",
      "contains",
      "join",
      `return (${expression})`,
    )(
      github,
      (value: string, prefix: string) => value.startsWith(prefix),
      (value: string, part: string) => value.includes(part),
      (value: string[], separator: string) => value.join(separator),
    ),
  );
}

test("every preview job has least-privilege credentials and checkout properties", async () => {
  const value = await workflow();
  const nodeVersion = (await fs.readFile(".nvmrc", "utf8")).trim();
  assert.equal(value.on.pull_request_target, undefined);
  assert.equal(value.permissions["pull-requests"], undefined);
  assert.equal(value.concurrency["cancel-in-progress"], true);
  const hasSecret = (object: unknown) =>
    /secrets\./u.test(JSON.stringify(object ?? {}));
  assert.equal(hasSecret(value.env), false);
  let installers = 0;
  for (const job of Object.values(value.jobs)) {
    assert.equal(hasSecret(job.env), false);
    assert.equal(hasSecret(job.with), false);
    assert.ok(
      Number.isInteger(job["timeout-minutes"]) && job["timeout-minutes"]! > 0,
    );
    const secretSteps = job.steps.filter(
      (step) => hasSecret(step.env) || hasSecret(step.with),
    );
    for (const step of secretSteps) assert.equal(hasSecret(step.with), false);
    if (secretSteps.length || job.permissions?.["pull-requests"] === "write") {
      assert.ok(job.if);
      for (const action of ["opened", "synchronize", "closed"])
        assert.equal(
          allowed(job.if, "pull_request", action, true, false),
          false,
        );
    }
    if (job.steps.some((step) => step.uses?.includes("checkout@"))) {
      installers++;
      for (const step of job.steps.filter((step) =>
        step.uses?.includes("checkout@"),
      )) {
        assert.equal(step.with?.["fetch-depth"], 0);
        assert.equal(step.with?.["persist-credentials"], false);
      }
      if (job.if && allowed(job.if, "pull_request", "opened", false, false))
        assert.equal(
          allowed(job.if, "pull_request", "opened", false, true),
          false,
        );
    }
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
      if (step.with?.cache)
        assert.equal(step.with["cache-dependency-path"], "package-lock.json");
      if (step.uses?.includes("setup-node@"))
        assert.equal(step.with?.["node-version"], nodeVersion);
    }
  }
  assert.ok(installers > 0);
});

test("host policy preserves its source and gives JSON and generations exact headers", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-hosting-"));
  try {
    const source = path.join(root, "source");
    const output = path.join(root, "deployment");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "index.html"), "site");
    await prepareHosting(source, output);
    assert.equal(
      await fs.readFile(path.join(output, "index.html"), "utf8"),
      "site",
    );
    const headers = await fs.readFile(path.join(output, "_headers"), "utf8");
    assert.match(headers, /X-Content-Type-Options: nosniff/);
    assert.match(
      headers,
      /! Cache-Control\n {2}Cache-Control: public, max-age=31536000, immutable/,
    );
    assert.match(headers, /Content-Type: application\/json; charset=utf-8/);
    assert.deepEqual(await fs.readdir(source), ["index.html"]);
    await assert.rejects(prepareHosting(source, source), /outside/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
