import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface Step {
  id?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string | boolean>;
}

interface Job {
  environment?: unknown;
  needs?: string | string[];
  "runs-on"?: string;
  strategy?: { matrix?: Record<string, unknown> };
  outputs?: Record<string, string>;
  steps?: Step[];
}

interface Workflow {
  env?: Record<string, string>;
  jobs: Record<string, Job>;
}

const revision = "55cc8345863c7cc4c66a329aec7e433d2d1c52a9";
const cachePath = ".turbo/cache";
const restorePrefix = "turbo-${{ runner.os }}-";

test("GitHub task caches have one saver, shared keys, and no credentials", async () => {
  const directory = path.join(repositoryRoot, ".github/workflows");
  const workflows = await Promise.all(
    (await fs.readdir(directory))
      .filter((file) => /\.ya?ml$/u.test(file))
      .map(async (file) => {
        const source = await fs.readFile(path.join(directory, file), "utf8");
        return { file, source, workflow: parse(source) as Workflow };
      }),
  );
  const savers = workflows.flatMap(({ file, workflow }) =>
    Object.entries(workflow.jobs).flatMap(([id, job]) =>
      (job.steps ?? [])
        .filter((step) => taskCache(step) && savesCache(step))
        .map((step) => ({ file, id, job, step })),
    ),
  );
  assert.equal(savers.length, 1, "only one job may save the task cache");
  const saver = savers[0]!;
  assert.equal(saver.file, "ci.yml", "CI owns the complete task directory");
  const keyReference = String(saver.step.with?.key);
  const keyOutput = /^\$\{\{ steps\.([\w-]+)\.outputs\.([\w-]+) \}\}$/u.exec(
    keyReference,
  );
  assert.ok(keyOutput, "the saver must use a computed step output");
  const keyStep = saver.job.steps?.find((step) => step.id === keyOutput[1]);
  assert.ok(keyStep, "the cache key step must exist");
  const hashExpressions = Object.values(keyStep.env ?? {}).filter((value) =>
    value.includes("hashFiles("),
  );
  assert.equal(hashExpressions.length, 1, "the key must hash task inputs once");
  const hashExpression = hashExpressions[0]!;
  const exportedOutput = Object.entries(saver.job.outputs ?? {}).find(
    ([, value]) => value === keyReference,
  );
  assert.ok(exportedOutput, "the saving job must expose the cache key");
  const suiteKey = `\${{ needs.${saver.id}.outputs.${exportedOutput[0]} }}`;
  let suites = 0;
  let previews = 0;
  let nativeJobs = 0;

  for (const { file, source, workflow } of workflows) {
    assert.doesNotMatch(
      source,
      /TURBO_TOKEN|TURBO_REMOTE_CACHE_SIGNATURE_KEY|secrets\s*(?:\.\s*TURBO_|\[\s*["']TURBO_)/iu,
      `${file} must not reference task-cache credentials`,
    );
    for (const [id, job] of Object.entries(workflow.jobs)) {
      const steps = job.steps ?? [];
      const caches = steps.filter(taskCache);
      for (const cache of caches) {
        assert.ok(
          ["actions/cache", "actions/cache/restore"].includes(
            cache.uses!.split("@")[0]!,
          ),
          "use the upstream cache actions",
        );
        assert.equal(cache.uses!.split("@")[1], revision);
        assert.equal(cache.with?.path, cachePath);
        assert.equal(cache.with?.["restore-keys"], restorePrefix);
        assert.notEqual(cache.with?.["fail-on-cache-miss"], true);
      }
      if (nativeRunner(job)) {
        nativeJobs++;
        assert.equal(caches.length, 0, "native jobs use local task caching");
      }
      if (file === "ci.yml" || file === "preview.yml")
        assert.equal(
          job.environment,
          undefined,
          "cache jobs need no environment",
        );
      const needs = Array.isArray(job.needs) ? job.needs : [job.needs];
      if (
        file === "ci.yml" &&
        id !== saver.id &&
        needs.includes(saver.id) &&
        steps.some((step) => /^\s*npm ci\b/mu.test(step.run ?? ""))
      ) {
        suites++;
        assert.equal(caches.length, 1, "each dependent suite restores once");
        assert.equal(caches[0]!.uses, `actions/cache/restore@${revision}`);
        assert.equal(caches[0]!.with?.key, suiteKey);
      }
      if (
        file === "preview.yml" &&
        steps.some((step) => /\bwrangler pages deploy\b/u.test(step.run ?? ""))
      ) {
        previews++;
        assert.equal(caches.length, 1, "each preview deploy restores once");
        assert.equal(caches[0]!.uses, `actions/cache/restore@${revision}`);
        assert.equal(caches[0]!.with?.key, `${restorePrefix}${hashExpression}`);
      }
    }
    if (["ci.yml", "preview.yml", "release.yml"].includes(file))
      assert.equal(workflow.env?.TURBO_TELEMETRY_DISABLED, "1");
    if (file === "release.yml") {
      assert.equal(workflow.env?.TURBO_FORCE, "true");
      assert.equal(workflow.env?.TURBO_CACHE, "local:rw");
      assert.equal(
        Object.values(workflow.jobs).flatMap((job) =>
          (job.steps ?? []).filter(taskCache),
        ).length,
        0,
      );
    }
  }
  assert.ok(suites > 0, "CI must have dependent suites");
  assert.equal(previews, 2, "both preview deploys must restore only");
  assert.ok(nativeJobs > 0, "native jobs must be checked");
});

function taskCache(step: Step): boolean {
  return String(step.with?.path ?? "")
    .split(/\s+/u)
    .includes(cachePath);
}

function savesCache(step: Step): boolean {
  return !step.uses?.startsWith("actions/cache/restore@");
}

function nativeRunner(job: Job): boolean {
  const runner = job["runs-on"] ?? "";
  const matrix = /matrix\.([\w-]+)/u.exec(runner);
  const values = matrix ? job.strategy?.matrix?.[matrix[1]!] : runner;
  return /macos|windows/iu.test(JSON.stringify(values) ?? "");
}
