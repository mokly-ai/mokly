import assert from "node:assert/strict";
import test from "node:test";

import {
  cacheEntry,
  defaultBudgets,
  runTiming,
} from "./helpers/ci_timing_run.js";

/** Budgets that every fixture job meets, so only the cache can warn. */
function generousBudgets(mode: "warn" | "fail", cache: unknown = undefined) {
  return {
    ...defaultBudgets(mode),
    wallClockMinutes: 60,
    cache: cache ?? { gigabytes: 1, largestEntries: 2 },
    jobs: [{ pattern: "*", minutes: 60 }],
  };
}

const LARGE = cacheEntry("v0-rust-cloud-app-Linux-x64", 600_000_000);
const NPM = cacheEntry("npm-Linux-X64", 441_424_837);
const PULL = cacheEntry("odd | key <b>", 52_000_000, "refs/pull/7/merge");
const OVER =
  "::warning title=Actions cache budget::The Actions cache holds 1.09 GB, above its 1 GB budget. GitHub evicts entries above 10 GB.";
const OTHER_REF =
  "::warning title=Actions cache budget::1 Actions cache entry, 52 MB, comes from refs other than refs/heads/main, the only ref that saves a cache.";
const FROM_MAIN = "Every entry comes from refs/heads/main.";
const FROM_PULL = "⚠️ Entries from refs other than refs/heads/main:";

function cacheSection(markdown: string): string {
  return markdown.slice(markdown.indexOf("### Actions cache"));
}

test("the summary lists the cache total, the largest entries, and entries from other refs", async (context) => {
  const result = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn"),
    caches: [LARGE, NPM, PULL],
  });
  assert.equal(result.status, 0);
  assert.equal(
    cacheSection(result.markdown),
    [
      "### Actions cache",
      "",
      "The cache holds 1.09 GB in 3 entries. Budget 1 GB, ⚠️ over by 93 MB. GitHub evicts the least recently used entries above 10 GB.",
      "",
      "Largest entries:",
      "",
      "| Entry | Ref | Size | Last used |",
      "| --- | --- | ---: | --- |",
      "| v0-rust-cloud-app-Linux-x64 | refs/heads/main | 600 MB | 2026-11-25 17:09 UTC |",
      "| npm-Linux-X64 | refs/heads/main | 441 MB | 2026-11-25 17:09 UTC |",
      "",
      FROM_PULL,
      "",
      "| Entry | Ref | Size | Last used |",
      "| --- | --- | ---: | --- |",
      "| odd \\| key &lt;b&gt; | refs/pull/7/merge | 52 MB | 2026-11-25 17:09 UTC |",
      "",
    ].join("\n"),
  );
});

test("each cache condition warns on its own and never fails the step in fail mode", async (context) => {
  const cases = [
    {
      name: "neither",
      caches: [LARGE],
      warnings: [],
      budget: "within budget",
      refs: FROM_MAIN,
    },
    {
      name: "over budget only",
      caches: [LARGE, NPM, cacheEntry("npm-macOS", 52_000_000)],
      warnings: [OVER],
      budget: "⚠️ over by 93 MB",
      refs: FROM_MAIN,
    },
    {
      name: "other ref only",
      caches: [LARGE, PULL],
      warnings: [OTHER_REF],
      budget: "within budget",
      refs: FROM_PULL,
    },
    {
      name: "both",
      caches: [LARGE, NPM, PULL],
      warnings: [OVER, OTHER_REF],
      budget: "⚠️ over by 93 MB",
      refs: FROM_PULL,
    },
  ];
  for (const { name, caches, warnings, budget, refs } of cases) {
    const result = await runTiming(context, {
      mode: "fail",
      budgets: generousBudgets("fail"),
      caches,
    });
    assert.equal(result.status, 0, name);
    assert.deepEqual(result.annotations.filter(Boolean), warnings, name);
    const section = cacheSection(result.markdown);
    assert.ok(section.includes(`Budget 1 GB, ${budget}.`), name);
    assert.ok(section.includes(refs), name);
  }
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
  assert.ok(
    result.markdown.includes("The cache holds 1.01 GB in 101 entries."),
  );
});

test("a saved cache list runs offline, and a partial list gives only lower bounds", async (context) => {
  const result = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn", { gigabytes: 8.5, largestEntries: 1 }),
    savedJobs: true,
    savedCaches: { total_count: 16, actions_caches: [LARGE] },
  });
  assert.deepEqual(result.requests, []);
  assert.ok(
    cacheSection(result.markdown).startsWith(
      [
        "### Actions cache",
        "",
        "⚠️ The report read 1 of 16 entries. They hold 600 MB, so the cache holds at least that. Budget 8.5 GB, not known to be within it. GitHub evicts the least recently used entries above 10 GB.",
      ].join("\n"),
    ),
  );
  assert.ok(
    result.markdown.includes(
      "Every entry that the report read comes from refs/heads/main. The other entries were not checked.",
    ),
  );
  assert.deepEqual(result.annotations, [
    "::warning title=CI duration budget::The report read 1 of 16 cache entries, so the cache total is a lower bound.",
  ]);
});

test("a saved list of pages counts every page, and saved jobs alone read no cache", async (context) => {
  const pages = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn"),
    savedJobs: true,
    savedCaches: [
      { total_count: 2, actions_caches: [LARGE] },
      { total_count: 2, actions_caches: [NPM] },
    ],
  });
  assert.deepEqual(pages.requests, []);
  assert.ok(pages.markdown.includes("The cache holds 1.04 GB in 2 entries."));
  const offline = await runTiming(context, {
    mode: "warn",
    budgets: generousBudgets("warn"),
    savedJobs: true,
  });
  assert.deepEqual(offline.requests, []);
  assert.deepEqual(offline.annotations, [""]);
  assert.ok(
    offline.markdown.includes(
      "### Actions cache\n\nThe Actions cache was not read.",
    ),
  );
});

test("an unreadable cache API or a bad cache budget adds a note and the report still runs", async (context) => {
  const cases = [
    {
      scenario: { cacheStatus: 403 },
      note: "The Actions cache could not be read: GitHub GET /repos/owner/repository/actions/caches?sort=size_in_bytes&direction=desc&per_page=100&page=1 failed (403); the job needs actions: read",
    },
    {
      scenario: {
        budgets: generousBudgets("fail", { gigabytes: 0, largestEntries: 1 }),
      },
      note: "The Actions cache was not checked: cache.gigabytes must be a positive number",
    },
    {
      scenario: { budgets: { ...generousBudgets("fail"), cache: undefined } },
      note: "The Actions cache was not checked: cache must hold gigabytes and largestEntries",
    },
  ];
  for (const { scenario, note } of cases) {
    const result = await runTiming(context, {
      mode: "fail",
      budgets: generousBudgets("fail"),
      ...scenario,
    });
    assert.equal(result.status, 0, note);
    assert.deepEqual(result.annotations, [
      `::warning title=CI duration budget::${note}`,
    ]);
    assert.ok(
      result.markdown.includes(
        "### Actions cache\n\nThe Actions cache was not read.",
      ),
      note,
    );
    assert.ok(result.markdown.includes("### Job durations"), note);
  }
});
