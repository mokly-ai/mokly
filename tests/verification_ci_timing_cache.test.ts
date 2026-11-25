import assert from "node:assert/strict";
import test from "node:test";

import {
  cacheEntry,
  defaultBudgets,
  runTiming,
} from "./helpers/ci_timing_run.js";

/** Budgets that every fixture job meets, so only the cache can warn. */
function generousBudgets(mode: "warn" | "fail") {
  return {
    ...defaultBudgets(mode),
    wallClockMinutes: 60,
    cache: { gigabytes: 1, largestEntries: 2 },
    jobs: [{ pattern: "*", minutes: 60 }],
  };
}

const CACHES = [
  cacheEntry("v0-rust-cloud-app-Linux-x64", 600_000_000),
  cacheEntry("npm-Linux-X64", 441_424_837),
  cacheEntry("odd | key <b>", 52_000_000, "refs/pull/7/merge"),
];

test("the summary lists the cache total, the largest entries, and entries from other refs", async (context) => {
  const result = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn"),
    caches: CACHES,
  });
  assert.equal(result.status, 0);
  const section = result.markdown.slice(
    result.markdown.indexOf("### Actions cache"),
  );
  assert.equal(
    section,
    [
      "### Actions cache",
      "",
      "The cache holds 1.09 GB in 3 entries, budget 1 GB, ⚠️ over by 93 MB. GitHub evicts the least recently used entries above 10 GB.",
      "",
      "Largest entries:",
      "",
      "| Entry | Ref | Size | Last used |",
      "| --- | --- | ---: | --- |",
      "| v0-rust-cloud-app-Linux-x64 | refs/heads/main | 600 MB | 2026-11-25 17:09 UTC |",
      "| npm-Linux-X64 | refs/heads/main | 441 MB | 2026-11-25 17:09 UTC |",
      "",
      "⚠️ Entries from refs other than refs/heads/main:",
      "",
      "| Entry | Ref | Size | Last used |",
      "| --- | --- | ---: | --- |",
      "| odd \\| key &lt;b&gt; | refs/pull/7/merge | 52 MB | 2026-11-25 17:09 UTC |",
      "",
    ].join("\n"),
  );
});

test("a cache above its budget or from other refs warns and never fails the step, also in fail mode", async (context) => {
  for (const mode of ["warn", "fail"] as const) {
    const result = await runTiming(context, {
      mode,
      budgets: generousBudgets(mode),
      caches: CACHES,
    });
    assert.equal(result.status, 0, mode);
    assert.deepEqual(
      result.annotations,
      [
        "::warning title=Actions cache budget::The Actions cache holds 1.09 GB, above its 1 GB budget. GitHub evicts entries above 10 GB.",
        "::warning title=Actions cache budget::1 Actions cache entries, 52 MB, come from refs other than refs/heads/main, the only ref that saves a cache.",
      ],
      mode,
    );
  }
});

test("a cache within its budget from main adds no warning", async (context) => {
  const result = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn"),
    caches: CACHES.slice(0, 1),
  });
  assert.deepEqual(result.annotations, [""]);
  assert.ok(
    result.markdown.includes(
      "The cache holds 600 MB in 1 entries, budget 1 GB, within budget.",
    ),
  );
  assert.ok(
    result.markdown.includes("Every entry comes from refs/heads/main."),
  );
});

test("cache entries past the first page count toward the total", async (context) => {
  const caches = Array.from({ length: 101 }, (_, index) =>
    cacheEntry(`entry-${index}`, 10_000_000),
  );
  const result = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn"),
    caches,
  });
  assert.deepEqual(
    result.requests
      .filter((request) => request.url.includes("/actions/caches?"))
      .map((request) => new URL(request.url).searchParams.get("page")),
    ["1", "2"],
  );
  assert.ok(result.markdown.includes("The cache holds 1.01 GB in 101 entries"));
});

test("an unreadable cache API adds a note and the report still runs", async (context) => {
  const result = await runTiming(context, {
    mode: "fail",
    budgets: generousBudgets("fail"),
    cacheStatus: 403,
  });
  assert.equal(result.status, 0);
  assert.deepEqual(result.annotations, [
    "::warning title=CI duration budget::The Actions cache could not be read: GitHub GET /repos/owner/repository/actions/caches?sort=size_in_bytes&direction=desc&per_page=100&page=1 failed (403); the job needs actions: read",
  ]);
  assert.ok(
    result.markdown.includes(
      "### Actions cache\n\nThe Actions cache was not read.",
    ),
  );
  assert.ok(result.markdown.includes("### Job durations"));
});
