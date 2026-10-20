import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value));
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function steps(job: Record<string, unknown>): Record<string, unknown>[] {
  assert.ok(Array.isArray(job.steps));
  return job.steps.map((step: unknown) => record(step));
}

function commands(job: Record<string, unknown>): string {
  return steps(job)
    .map((step) => String(step.run ?? ""))
    .join("\n");
}

test("the daily Rust audit cannot access the update job's write credentials", async () => {
  const value: unknown = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/dependency-audit.yml"),
      "utf8",
    ),
  );
  const workflow = record(value);
  const jobs = Object.entries(record(workflow.jobs)).map(([name, job]) => ({
    name,
    job: record(job),
  }));
  const rust = jobs.filter(({ job }) =>
    commands(job).includes("dependencies:check:rust"),
  );
  assert.equal(rust.length, 1);
  const { name, job } = rust[0]!;
  assert.deepEqual(record(job.permissions), { contents: "read" });
  assert.equal(job["timeout-minutes"], 30);
  assert.equal(
    job.needs,
    undefined,
    "the Rust audit must run when npm automation fails",
  );
  assert.doesNotMatch(JSON.stringify(job), /secrets\./);
  const checkout = steps(job).find((step) =>
    String(step.uses ?? "").startsWith("useblacksmith/checkout@"),
  );
  assert.ok(checkout);
  assert.equal(record(checkout.with).ref, "main");
  assert.equal(record(checkout.with)["persist-credentials"], false);
  assert.equal(record(checkout.with).token, undefined);
  assert.match(commands(job), /rustup toolchain install/);
  const automation = jobs.filter(({ job }) =>
    commands(job).includes("dependency-audit-pr.mjs"),
  );
  assert.equal(automation.length, 1);
  assert.notEqual(automation[0]!.name, name);
  assert.equal(record(automation[0]!.job.permissions).contents, "write");
  assert.doesNotMatch(
    commands(automation[0]!.job),
    /\bcargo\b|\brustup\b|dependencies:check:rust/,
  );
});
