import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { runCiTiming } from "../scripts/verification/ci-timing.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const FIXTURES = path.join(repositoryRoot, "tests/fixtures/ci-timing");

interface Scenario {
  mode: "warn" | "fail";
  status?: number;
  extraJobs?: unknown[];
  budgets?: unknown;
}

async function run(context: TestContext, scenario: Scenario) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ci-timing-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const budgets = path.join(directory, "budgets.json");
  await fs.writeFile(
    budgets,
    JSON.stringify(
      scenario.budgets ?? {
        mode: scenario.mode,
        wallClockMinutes: 13,
        slowestTests: 1,
        jobs: [
          { pattern: "Native *", minutes: 12 },
          { pattern: "Viewer *", minutes: 12 },
          { pattern: "Browser *", minutes: 20 },
          { pattern: "Site Lighthouse", minutes: 10 },
          { pattern: "Required CI", minutes: 3 },
          { pattern: "Runtime profile", minutes: 2 },
          { pattern: "Cloud provider plan result", minutes: 2 },
        ],
      },
    ),
  );
  const reports = path.join(directory, "reports/verification-viewer");
  await fs.mkdir(reports, { recursive: true });
  await fs.copyFile(
    path.join(FIXTURES, "report-viewer.json"),
    path.join(reports, "viewer.json"),
  );
  const body = JSON.parse(
    await fs.readFile(path.join(FIXTURES, "jobs-first-attempt.json"), "utf8"),
  ) as { total_count: number; jobs: unknown[] };
  body.jobs.push(...(scenario.extraJobs ?? []));
  const requests: { url: string; authorization: string | null }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    const page = Number(new URL(String(input)).searchParams.get("page"));
    const jobs = body.jobs.slice((page - 1) * 100, page * 100);
    return new Response(
      JSON.stringify({ total_count: body.jobs.length, jobs }),
      { status: scenario.status ?? 200 },
    );
  };
  const summary = path.join(directory, "summary.md");
  let stdout = "";
  const status = await runCiTiming({
    argv: [
      "--budgets",
      budgets,
      "--reports",
      path.dirname(reports),
      "--self",
      "CI timing",
    ],
    env: {
      GITHUB_TOKEN: "token-value",
      GITHUB_API_URL: "https://api.example.test",
      GITHUB_REPOSITORY: "owner/repository",
      GITHUB_RUN_ID: "42",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_STEP_SUMMARY: summary,
    },
    fetch,
    write: { stdout: (text) => (stdout += text) },
  });
  const markdown = await fs.readFile(summary, "utf8");
  return {
    status,
    requests,
    markdown,
    annotations: stdout.trimEnd().split("\n"),
  };
}

const running = (name: string, id: number) => ({
  id,
  name,
  status: "in_progress",
  conclusion: null,
  created_at: "2026-11-25T00:02:52Z",
  started_at: "2026-11-25T00:02:54Z",
  completed_at: null,
});

test("warn mode summarises budgets and warns without failing", async (context) => {
  const result = await run(context, {
    mode: "warn",
    extraJobs: [running("CI timing", 1), running("Late job", 2)],
  });
  assert.equal(result.status, 0);
  assert.deepEqual(result.requests, [
    {
      url: "https://api.example.test/repos/owner/repository/actions/runs/42/jobs?filter=latest&per_page=100&page=1",
      authorization: "Bearer token-value",
    },
  ]);
  assert.deepEqual(result.annotations, [
    "::warning title=CI duration budget::The run took 29m 02s, above its 13m wall-clock budget.",
    '::warning title=CI duration budget::Native (windows-2025) ran 28m 42s, above its 12m budget (pattern "Native *").',
    "::warning title=CI duration budget::Late job was in_progress when the report ran, so it has no duration.",
  ]);
  const lines = result.markdown.split("\n");
  for (const line of [
    "Wall clock of attempt 1: 29m 02s, budget 13m, ⚠️ over by 16m 02s.",
    "| [Native (windows-2025)](https://github.com/mokly-ai/mokly/actions/runs/45510952140/job/138858487947) | success | 28m 42s | 12m (`Native *`) | ⚠️ over by 16m 42s | Run native verification, 25m 15s |",
    "| tests/static_base_manager_ci.test.ts | viewer, node-22.15.0 | 1 | 1m 04s |",
  ])
    assert.ok(lines.includes(line), line);
  assert.equal(result.markdown.includes("CI timing was"), false);
});

test("fail mode fails the step for an overrun", async (context) => {
  const result = await run(context, { mode: "fail" });
  assert.equal(result.status, 1);
  assert.deepEqual(result.annotations.slice(0, 2), [
    "::error title=CI duration budget::The run took 29m 02s, above its 13m wall-clock budget.",
    '::error title=CI duration budget::Native (windows-2025) ran 28m 42s, above its 12m budget (pattern "Native *").',
  ]);
});

test("an unreadable jobs API warns in warn mode and fails in fail mode", async (context) => {
  for (const [mode, status, level] of [
    ["warn", 0, "warning"],
    ["fail", 1, "error"],
  ] as const) {
    const result = await run(context, { mode, status: 403 });
    assert.equal(result.status, status, mode);
    assert.deepEqual(result.annotations, [
      `::${level} title=CI timing report::GitHub GET /repos/owner/repository/actions/runs/42/jobs?filter=latest&per_page=100&page=1 failed (403); the job needs actions: read`,
    ]);
    assert.match(
      result.markdown,
      /^## CI timing\n\nThe report could not run: GitHub GET/,
    );
  }
});

test("job names cannot add workflow commands or break the summary table", async (context) => {
  const name = "Odd \\| job\n::error::injected <b>";
  const result = await run(context, {
    mode: "warn",
    extraJobs: [
      {
        id: 3,
        name,
        status: "completed",
        conclusion: "success",
        created_at: "2026-11-24T23:33:56Z",
        started_at: "2026-11-24T23:33:57Z",
        completed_at: "2026-11-24T23:34:57Z",
      },
    ],
  });
  assert.ok(
    result.annotations.includes(
      "::warning title=CI duration budget::Odd \\| job%0A::error::injected <b> has no budget. Add a matching pattern to scripts/verification/ci-budgets.json.",
    ),
  );
  assert.ok(
    result.markdown.includes(
      "| Odd \\\\\\| job ::error::injected &lt;b&gt; | success | 1m 00s | none | ⚠️ no budget | – |",
    ),
  );
});

const completed = (name: string, id: number) => ({
  id,
  name,
  status: "completed",
  conclusion: "success",
  created_at: "2026-11-24T23:33:56Z",
  started_at: "2026-11-24T23:33:57Z",
  completed_at: "2026-11-24T23:34:57Z",
});

test("jobs past the first page count, and annotations stop at the GitHub limit", async (context) => {
  const extraJobs = Array.from({ length: 120 }, (_, index) =>
    completed(`Extra ${String(index).padStart(3, "0")}`, 1000 + index),
  );
  const result = await run(context, { mode: "warn", extraJobs });
  assert.deepEqual(
    result.requests.map((request) =>
      new URL(request.url).searchParams.get("page"),
    ),
    ["1", "2"],
  );
  assert.ok(
    result.markdown.includes(
      "| Extra 119 | success | 1m 00s | none | ⚠️ no budget | – |",
    ),
  );
  assert.equal(result.annotations.length, 10);
  assert.equal(
    result.annotations[8],
    "::warning title=CI duration budget::Extra 007 has no budget. Add a matching pattern to scripts/verification/ci-budgets.json.",
  );
  assert.equal(
    result.annotations[9],
    "::warning title=CI duration budget::113 more findings are in the job summary.",
  );
});

test("a fail-mode budget file that does not parse fails the step", async (context) => {
  const result = await run(context, {
    mode: "fail",
    budgets: { mode: "fail", wallClockMinutes: 0, slowestTests: 1, jobs: [] },
  });
  assert.equal(result.status, 1);
  assert.match(
    result.annotations[0]!,
    /^::error title=CI timing report::wallClockMinutes must be a positive number/,
  );
});
