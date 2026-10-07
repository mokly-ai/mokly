import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  credentialSteps,
  mainCacheCondition,
  prCacheCondition,
  readCacheWorkflow,
  trustedCacheEnvironment,
} from "./helpers/turbo_ci.js";

const execute = promisify(execFile);
const script = "node scripts/verification/turbo-cache-env.mjs";
const mainVariables = {
  CACHE_TOKEN: "${{ secrets.TURBO_CACHE_TRUSTED_WRITE_TOKEN }}",
  CACHE_SIGNATURE_KEY: "${{ secrets.TURBO_CACHE_SIGNATURE_KEY }}",
};
const prVariables = {
  CACHE_TOKEN: "${{ secrets.TURBO_CACHE_PR_WRITE_TOKEN }}",
  CACHE_SIGNATURE_KEY: "${{ secrets.TURBO_CACHE_SIGNATURE_KEY }}",
  CACHE_TEAM: "mokly-pr-${{ github.event.pull_request.number }}",
};

test("every preparing CI job selects the main environment and gates each principal", async () => {
  const workflow = await readCacheWorkflow("ci.yml");
  for (const name of ["prepare", "package", "unit", "browser", "hydration"]) {
    const job = workflow.jobs[name]!;
    assert.deepEqual(job.environment, trustedCacheEnvironment, name);
    const [main, pr] = credentialSteps(job);
    assert.ok(main && pr);
    assert.equal(credentialSteps(job).length, 2);
    assert.equal(main.if, mainCacheCondition);
    assert.equal(pr.if, prCacheCondition);
    assert.deepEqual(main.env, mainVariables);
    assert.deepEqual(pr.env, prVariables);
    assert.equal(main.run, script);
    assert.equal(pr.run, script);
    const install = job.steps.findIndex((step) => step.run === "npm ci");
    assert.ok(job.steps.indexOf(main) > install);
    const check = job.steps.findIndex(
      (step) =>
        step.run?.startsWith("cargo xtask check") ||
        step.run === "npm run prepare:verification",
    );
    assert.ok(check > job.steps.indexOf(pr));
  }
  const prepare = workflow.jobs.prepare!;
  assert.equal(prepare.needs, undefined);
  assert.ok(
    prepare.steps.some((step) => step.run === "npm run prepare:verification"),
  );
  assert.equal(
    prepare.steps.find((step) => step.name === "Set up Node.js")!.with?.[
      "node-version"
    ],
    "22.14.0",
  );
  assert.ok(
    prepare.steps.some(
      (step) => step.run === "npm install --global npm@11.21.0",
    ),
  );
  assert.ok(!JSON.stringify(prepare.steps).match(/rustup|playwright install/u));
  const required = workflow.jobs.required!.steps.find(
    (step) => step.name === "Require every verification job",
  )!;
  assert.equal(required.env!.PREPARE_RESULT, "${{ needs.prepare.result }}");
  assert.ok(required.run!.includes('test "$PREPARE_RESULT" = success'));
});

test("preview principals are separate and release/native jobs have no cache credential steps", async () => {
  const preview = await readCacheWorkflow("preview.yml");
  const main = preview.jobs["deploy-main"]!;
  assert.deepEqual(main.environment, {
    name: "turbo-cache-trusted",
    deployment: false,
  });
  assert.equal(main.if, mainCacheCondition);
  assert.equal(credentialSteps(main).length, 1);
  assert.deepEqual(credentialSteps(main)[0]!.env, mainVariables);
  const pr = preview.jobs["deploy-pr"]!;
  assert.equal(pr.environment, undefined);
  assert.equal(credentialSteps(pr).length, 1);
  assert.equal(credentialSteps(pr)[0]!.if, prCacheCondition);
  assert.deepEqual(credentialSteps(pr)[0]!.env, prVariables);
  const ci = await readCacheWorkflow("ci.yml");
  assert.equal(credentialSteps(ci.jobs.native!).length, 0);
  assert.equal(ci.jobs.native!.environment, undefined);
  for (const job of Object.values(
    (await readCacheWorkflow("release.yml")).jobs,
  ))
    assert.equal(credentialSteps(job).length, 0);
});

test("the GitHub env mapping runs main, same-repository PR and fork paths without empty Turbo credentials", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-turbo-ci-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const job = (await readCacheWorkflow("ci.yml")).jobs.prepare!;
  for (const scenario of ["main", "pr", "fork"] as const)
    for (const credentials of ["both", "token", "key", "neither"] as const) {
      const file = path.join(directory, `${scenario}-${credentials}`);
      await fs.writeFile(file, "TURBO_CACHE=local:rw\n");
      for (const step of credentialSteps(job)) {
        const executes =
          scenario === "main"
            ? step.if === mainCacheCondition
            : scenario === "pr" && step.if === prCacheCondition;
        if (!executes) continue;
        const token =
          credentials === "both" || credentials === "token"
            ? `test-${scenario}-token`
            : "";
        const key =
          credentials === "both" || credentials === "key" ? "b".repeat(64) : "";
        const env = {
          ...process.env,
          GITHUB_ENV: file,
          CACHE_TOKEN: token,
          CACHE_SIGNATURE_KEY: key,
          CACHE_TEAM: scenario === "pr" ? "mokly-pr-42" : "",
        };
        const result = await execute("bash", ["-e", "-c", step.run!], {
          cwd: repositoryRoot,
          env,
        });
        assert.equal(result.stdout, "");
        assert.equal(result.stderr, "");
      }
      const variables = Object.fromEntries(
        (await fs.readFile(file, "utf8"))
          .trim()
          .split("\n")
          .map((line) => {
            const split = line.indexOf("=");
            return [line.slice(0, split), line.slice(split + 1)];
          }),
      );
      const remote = scenario !== "fork" && credentials === "both";
      assert.equal(
        variables.TURBO_CACHE,
        remote ? "local:rw,remote:rw" : "local:rw",
      );
      assert.equal(
        variables.TURBO_TOKEN,
        remote ? `test-${scenario}-token` : undefined,
      );
      assert.equal(
        variables.TURBO_REMOTE_CACHE_SIGNATURE_KEY,
        remote ? "b".repeat(64) : undefined,
      );
      assert.equal(
        variables.TURBO_TEAM,
        remote && scenario === "pr" ? "mokly-pr-42" : undefined,
      );
      assert.equal(variables.TURBO_TEAMID, undefined);
    }
});
