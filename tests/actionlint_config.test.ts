import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return Object.fromEntries(Object.entries(value));
}

test("actionlint configuration lists exactly the workflow runner labels", async () => {
  const directory = path.join(repositoryRoot, ".github");
  const config = record(
    parse(await fs.readFile(path.join(directory, "actionlint.yaml"), "utf8")),
  );
  const runnerConfig = record(config["self-hosted-runner"]);
  const labels = runnerConfig.labels;
  assert.ok(Array.isArray(labels));
  assert.deepEqual(Object.keys(config), ["self-hosted-runner"]);
  assert.deepEqual(Object.keys(runnerConfig), ["labels"]);

  const workflows = await fs.readdir(path.join(directory, "workflows"));
  const used = new Set<string>();
  for (const file of workflows.filter((name) => name.endsWith(".yml"))) {
    const workflow = record(
      parse(await fs.readFile(path.join(directory, "workflows", file), "utf8")),
    );
    const jobs = record(workflow.jobs);
    for (const jobValue of Object.values(jobs)) {
      const job = record(jobValue);
      const runner = job["runs-on"];
      const matrix = job.strategy ? record(job.strategy).matrix : undefined;
      const candidates = matrix
        ? Object.values(record(matrix)).flatMap(matrixValues)
        : [runner];
      for (const candidate of candidates)
        if (
          typeof candidate === "string" &&
          candidate.startsWith("blacksmith-")
        )
          used.add(candidate);
    }
  }
  assert.deepEqual(labels, [...used].sort());
});

function matrixValues(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [value];
  return value.flatMap((entry) =>
    recordLike(entry) ? Object.values(entry) : [entry],
  );
}

function recordLike(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
