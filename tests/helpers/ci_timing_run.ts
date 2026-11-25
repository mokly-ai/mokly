import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { runCiTiming } from "../../scripts/verification/ci-timing.mjs";

import { repositoryRoot } from "./fixture.js";

const FIXTURES = path.join(repositoryRoot, "tests/fixtures/ci-timing");
const PAGE_SIZE = 100;

export interface TimingScenario {
  mode: "warn" | "fail";
  /** The HTTP status of the jobs API. */
  status?: number;
  extraJobs?: unknown[];
  budgets?: unknown;
  /** The entries that the cache API lists; one small `main` entry by default. */
  caches?: unknown[];
  /** The HTTP status of the cache API. */
  cacheStatus?: number;
  /** Read the jobs fixture from `--jobs-file` instead of the API. */
  savedJobs?: boolean;
  /** A saved cache list that `--caches-file` reads. */
  savedCaches?: unknown;
}

/** One cache entry of the API, saved from `main` unless `ref` says otherwise. */
export function cacheEntry(
  key: string,
  bytes: number,
  ref = "refs/heads/main",
) {
  return {
    id: bytes,
    key,
    ref,
    size_in_bytes: bytes,
    last_accessed_at: "2026-11-25T17:09:07.673Z",
  };
}

/**
 * Run the timing report over the first-attempt jobs fixture, a viewer report,
 * and a fake GitHub API. Resolve to the exit status, the requested URLs, the
 * job summary, and the annotation lines.
 */
export async function runTiming(
  context: TestContext,
  scenario: TimingScenario,
) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ci-timing-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const budgets = path.join(directory, "budgets.json");
  await fs.writeFile(
    budgets,
    JSON.stringify(scenario.budgets ?? defaultBudgets(scenario.mode)),
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
  const caches = scenario.caches ?? [cacheEntry("npm-Linux-X64-lock", 4e8)];
  const requests: { url: string; authorization: string | null }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    const url = new URL(String(input));
    const page = Number(url.searchParams.get("page"));
    const slice = (items: unknown[]) =>
      items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const [response, status] = url.pathname.endsWith("/actions/caches")
      ? [
          { total_count: caches.length, actions_caches: slice(caches) },
          scenario.cacheStatus,
        ]
      : [
          { total_count: body.jobs.length, jobs: slice(body.jobs) },
          scenario.status,
        ];
    return new Response(JSON.stringify(response), { status: status ?? 200 });
  };
  const saved: string[] = [];
  if (scenario.savedJobs)
    saved.push("--jobs-file", path.join(FIXTURES, "jobs-first-attempt.json"));
  if (scenario.savedCaches !== undefined) {
    const file = path.join(directory, "caches.json");
    await fs.writeFile(file, JSON.stringify(scenario.savedCaches));
    saved.push("--caches-file", file);
  }
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
      ...saved,
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

/** Budgets over the first-attempt fixture, with a 8.5 GB cache budget. */
export function defaultBudgets(mode: "warn" | "fail") {
  return {
    mode,
    wallClockMinutes: 13,
    slowestTests: 1,
    cache: { gigabytes: 8.5, largestEntries: 2 },
    jobs: [
      { pattern: "Native *", minutes: 12 },
      { pattern: "Viewer *", minutes: 12 },
      { pattern: "Browser *", minutes: 20 },
      { pattern: "Site Lighthouse", minutes: 10 },
      { pattern: "Required CI", minutes: 3 },
      { pattern: "Runtime profile", minutes: 2 },
      { pattern: "Cloud provider plan result", minutes: 2 },
    ],
  };
}
