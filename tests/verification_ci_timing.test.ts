import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  evaluateJobs,
  matchBudget,
  parseBudgets,
} from "../scripts/verification/ci-timing-budgets.mjs";
import { parseJobs } from "../scripts/verification/ci-timing-jobs.mjs";
import { criticalPath } from "../scripts/verification/ci-timing-path.mjs";
import { slowestTests } from "../scripts/verification/ci-timing-tests.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const FIXTURES = path.join(repositoryRoot, "tests/fixtures/ci-timing");

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(FIXTURES, name), "utf8"));
}

async function fixtureJobs(name: string) {
  const body = (await fixture(name)) as { jobs: unknown[] };
  return parseJobs(body.jobs).jobs;
}

const budgets = parseBudgets({
  mode: "warn",
  wallClockMinutes: 13,
  slowestTests: 2,
  jobs: [
    { pattern: "Browser *", minutes: 10 },
    { pattern: "Browser (Node 24*", minutes: 5 },
    { pattern: "Native (macos-26)", minutes: 12 },
    { pattern: "Native *", minutes: 12 },
    { pattern: "App checks*", minutes: 10 },
    { pattern: "Viewer *", minutes: 12 },
    { pattern: "Required CI", minutes: 3 },
    { pattern: "Credential-gated infrastructure plan", minutes: 10 },
  ],
});

test("budget patterns match whole job names and the first match wins", () => {
  const cases: [string, string | null][] = [
    ["Browser (Node 24, shard 1/6)", "Browser *"],
    ["Native (macos-26)", "Native (macos-26)"],
    ["Native macos-26", "Native *"],
    ["App checks", "App checks*"],
    ["App checks 3/6", "App checks*"],
    ["Required CI rerun", null],
    ["Site checks", null],
  ];
  for (const [name, expected] of cases)
    assert.equal(matchBudget(name, budgets)?.pattern ?? null, expected, name);
  const literal = parseBudgets({
    ...budgets,
    jobs: [{ pattern: "Native (macos-26)", minutes: 1 }],
  });
  assert.equal(matchBudget("Native macos-26", literal), null);
});

test("an invalid budget file names the field it rejects", () => {
  assert.throws(
    () => parseBudgets({ ...budgets, mode: "error" }),
    /budget mode must be one of warn, fail/,
  );
  assert.throws(
    () =>
      parseBudgets({ ...budgets, jobs: [{ pattern: "Viewer *", minutes: 0 }] }),
    /jobs\[0\]\.minutes must be a positive number of minutes/,
  );
});

test("job rows compare run time with the budget and mark jobs without one", async () => {
  const rows = evaluateJobs(
    await fixtureJobs("jobs-first-attempt.json"),
    budgets,
  );
  assert.deepEqual(
    rows.map((row) => [
      row.job.name,
      row.seconds,
      row.budget?.pattern ?? null,
      row.state,
    ]),
    [
      ["Native (windows-2025)", 1722, "Native *", "over"],
      ["Browser (Node 22.15.0, shard 4/4)", 1036, "Browser *", "over"],
      ["Viewer (Node 22.15.0)", 676, "Viewer *", "within"],
      ["Site Lighthouse", 281, null, "no-budget"],
      ["Required CI", 11, "Required CI", "within"],
      ["Cloud provider plan result", 4, null, "no-budget"],
      ["Runtime profile", 4, null, "no-budget"],
    ],
  );
  assert.deepEqual(rows[0]!.slowestStep, {
    name: "Run native verification",
    seconds: 1515,
  });
});

test("a rerun keeps the durations of reused jobs and skips skipped jobs", async () => {
  const { jobs, issues } = parseJobs([
    ...((await fixture("jobs-rerun.json")) as { jobs: unknown[] }).jobs,
    { id: 1, name: "No creation time" },
  ]);
  assert.deepEqual(issues, ["job entry 5 has no id, name, or creation time"]);
  assert.deepEqual(
    jobs.map((job) => [job.name, job.reused]),
    [
      ["Runtime profile", true],
      ["Credential-gated infrastructure plan", true],
      ["Viewer (Node 22.15.0)", false],
      ["Native (windows-2025)", true],
      ["Required CI", false],
    ],
  );
  const rows = evaluateJobs(jobs, budgets);
  assert.deepEqual(
    rows.map((row) => [row.job.name, row.seconds, row.state]),
    [
      ["Native (windows-2025)", 1811, "over"],
      ["Viewer (Node 22.15.0)", 662, "within"],
      ["Required CI", 11, "within"],
      ["Runtime profile", 5, "no-budget"],
      ["Credential-gated infrastructure plan", 0, "not-run"],
    ],
  );
});

test("the critical path of a first attempt follows the blocking jobs", async () => {
  const found = criticalPath(await fixtureJobs("jobs-first-attempt.json"));
  assert.ok(found);
  assert.equal(found.wallSeconds, 1742);
  assert.equal(found.reusedJobs, 0);
  assert.deepEqual(
    found.segments.map((segment) => [
      segment.job.name,
      segment.waitSeconds,
      segment.runSeconds,
      segment.endSeconds,
    ]),
    [
      ["Runtime profile", 2, 4, 6],
      ["Native (windows-2025)", 2, 1722, 1730],
      ["Required CI", 1, 11, 1742],
    ],
  );
});

test("the critical path of a rerun covers only the jobs that ran again", async () => {
  const found = criticalPath(await fixtureJobs("jobs-rerun.json"));
  assert.ok(found);
  assert.deepEqual(
    [found.wallSeconds, found.ranJobs, found.reusedJobs],
    [677, 2, 3],
  );
  assert.deepEqual(
    found.segments.map((segment) => [
      segment.job.name,
      segment.waitSeconds,
      segment.endSeconds,
    ]),
    [
      ["Viewer (Node 22.15.0)", 2, 664],
      ["Required CI", 2, 677],
    ],
  );
});

test("the slowest tests come from browser tests and viewer files", async () => {
  const reports = [
    await fixture("report-browser-shard-3.json"),
    await fixture("report-viewer.json"),
    null,
    { suite: "viewer", observedFiles: "not a list" },
  ];
  const slowest = slowestTests(reports, 2);
  assert.deepEqual(
    slowest.tests.map((row) => [row.name, row.source, row.ms]),
    [
      [
        "chromium › serve_changes_continuity.spec.ts › background evidence preserves All without replacing documents (desktop)",
        "browser 3/4, node-22.15.0",
        9215,
      ],
      [
        "chromium › static_component_workspace.spec.ts › view controls, folds, and highlighting work inside sandboxed Browse frames",
        "browser 3/4, node-22.15.0",
        8779,
      ],
    ],
  );
  assert.deepEqual(
    slowest.files.map((row) => [row.name, row.source, row.tests, row.ms]),
    [
      [
        "tests/static_base_manager_ci.test.ts",
        "viewer, node-22.15.0",
        1,
        64185.379184,
      ],
      [
        "tests/static_base_managers.test.ts",
        "viewer, node-22.15.0",
        17,
        59763.881197,
      ],
    ],
  );
});

test("on a completion tie the job created later blocks the next job", () => {
  const job = (
    id: number,
    name: string,
    created: string,
    completed: string,
  ) => ({
    id,
    name,
    status: "completed",
    conclusion: "success",
    created_at: `2026-11-25T00:${created}Z`,
    started_at: `2026-11-25T00:${created}Z`,
    completed_at: `2026-11-25T00:${completed}Z`,
  });
  const { jobs } = parseJobs([
    job(1, "Root report", "00:00", "05:00"),
    job(2, "Runtime profile", "00:00", "00:10"),
    job(3, "Native", "00:10", "05:00"),
    job(4, "Required CI", "05:00", "05:10"),
  ]);
  assert.deepEqual(
    criticalPath(jobs)?.segments.map((segment) => segment.job.name),
    ["Runtime profile", "Native", "Required CI"],
  );
});

test("the committed budget file parses", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, "scripts/verification/ci-budgets.json"),
    "utf8",
  );
  assert.doesNotThrow(() => parseBudgets(JSON.parse(source)));
});
