import assert from "node:assert/strict";
import test from "node:test";

import { defaultBudgets, runTiming } from "./helpers/ci_timing_run.js";

const START = Date.parse("2026-11-25T00:03:00Z");

/** One completed job of the API that ran for `seconds`. */
function job(
  id: number,
  name: string,
  seconds: number,
  conclusion = "success",
) {
  return {
    id,
    name,
    status: "completed",
    conclusion,
    created_at: new Date(START).toISOString(),
    started_at: new Date(START).toISOString(),
    completed_at: new Date(START + seconds * 1000).toISOString(),
    html_url: `https://github.com/owner/repository/actions/runs/42/job/${id}`,
  };
}

const SHARD_JOBS = [
  job(101, "Browser (Node 24.11.0, shard 1/3)", 300),
  job(102, "Browser (Node 24.11.0, shard 2/3)", 465),
  job(103, "Browser (Node 24.11.0, shard 3/3)", 900, "failure"),
  job(201, "App checks 1/2", 400),
  job(202, "App checks 2/2", 430),
  job(301, "Mockup checks 1/4", 100),
  job(303, "Mockup checks 3/4", 200),
  job(304, "Mockup checks 4/4", 350),
  job(401, "Viewer (Node 22.15.0, shard 1/2)", 300),
  job(402, "Viewer (Node 22.15.0, shard 2/2)", 0, "cancelled"),
];

const SHARD_GROUPS = [
  {
    name: "Browser",
    patterns: ["Browser (Node 24.*, shard */*)"],
    spreadMinutes: 2,
  },
  { name: "App", patterns: ["App checks */*"], spreadMinutes: 1 },
  {
    name: "Mockup disk suite",
    patterns: ["Mockup checks 3/4", "Mockup checks 4/4"],
    spreadMinutes: 2,
    weighted: false,
  },
  {
    name: "Viewer",
    patterns: ["Viewer (Node *, shard */*)"],
    spreadMinutes: 2,
  },
  { name: "Native", patterns: ["Native (*, shard */*)"], spreadMinutes: 2 },
];

/** Budgets that every job meets, so only the shard balance can warn. */
function shardBudgets(mode: "warn" | "fail", shardGroups: unknown) {
  return {
    ...defaultBudgets(mode),
    wallClockMinutes: 60,
    cache: { gigabytes: 1, largestEntries: 0 },
    jobs: [{ pattern: "*", minutes: 60 }],
    shardGroups,
  };
}

function shardSection(markdown: string): string {
  const start = markdown.indexOf("### Shard balance");
  return markdown.slice(start, markdown.indexOf("### Slowest tests", start));
}

function link(id: number, name: string): string {
  return `[${name}](https://github.com/owner/repository/actions/runs/42/job/${id})`;
}

test("the shard balance compares the passed shards of each group and warns above the spread budget, also in fail mode", async (context) => {
  const result = await runTiming(context, {
    mode: "fail",
    budgets: shardBudgets("fail", SHARD_GROUPS),
    extraJobs: SHARD_JOBS,
  });
  assert.equal(result.status, 0);
  assert.equal(
    shardSection(result.markdown),
    [
      "### Shard balance",
      "",
      "The spread of a group is the run time of its slowest passed shard minus that of its fastest passed shard in this run.",
      "",
      "| Group | Passed | Fastest | Slowest | Spread | Budget | Status |",
      "| --- | ---: | --- | --- | ---: | ---: | --- |",
      `| Browser | 2 of 3 | ${link(101, "Browser (Node 24.11.0, shard 1/3)")}, 5m 00s | ${link(102, "Browser (Node 24.11.0, shard 2/3)")}, 7m 45s | 2m 45s | 2m | ⚠️ over by 45s |`,
      `| App | 2 of 2 | ${link(201, "App checks 1/2")}, 6m 40s | ${link(202, "App checks 2/2")}, 7m 10s | 30s | 1m | within |`,
      `| Mockup disk suite (unweighted) | 2 of 2 | ${link(303, "Mockup checks 3/4")}, 3m 20s | ${link(304, "Mockup checks 4/4")}, 5m 50s | 2m 30s | 2m | ⚠️ over by 30s |`,
      "| Viewer | 1 of 2 | – | – | – | 2m | fewer than 2 passed shards |",
      "| Native | 0 of 0 | – | – | – | 2m | not run |",
      "",
      "Refresh the weights from the newest green `main` runs with `npm run ci:refresh-shard-weights`.",
      "",
      "",
    ].join("\n"),
  );
  assert.deepEqual(result.annotations, [
    "::warning title=Shard balance::The Browser shards spread 2m 45s, above the 2m budget: Browser (Node 24.11.0, shard 2/3) ran 7m 45s and Browser (Node 24.11.0, shard 1/3) ran 5m 00s. Run `npm run ci:refresh-shard-weights` to refresh the shard weights.",
    "::warning title=Shard balance::The Mockup disk suite shards spread 2m 30s, above the 2m budget: Mockup checks 4/4 ran 5m 50s and Mockup checks 3/4 ran 3m 20s. No weight file balances this group, so move tests between its spec files or change its shard count.",
  ]);
});

test("a shard group field that does not parse adds a note and the report still runs", async (context) => {
  const cases = [
    {
      shardGroups: undefined,
      note: "shardGroups must list at least one group",
    },
    {
      shardGroups: [{ name: "Browser", patterns: [], spreadMinutes: 2 }],
      note: "shardGroups[0].patterns must list at least one job-name pattern",
    },
    {
      shardGroups: [{ name: "App", patterns: ["App *"], spreadMinutes: 0 }],
      note: "shardGroups[0].spreadMinutes must be a positive number",
    },
  ];
  for (const { shardGroups, note } of cases) {
    const result = await runTiming(context, {
      mode: "warn",
      budgets: shardBudgets("warn", shardGroups),
      extraJobs: SHARD_JOBS,
    });
    assert.equal(result.status, 0, note);
    assert.equal(
      shardSection(result.markdown),
      "### Shard balance\n\nThe shard balance was not checked.\n\n",
      note,
    );
    assert.deepEqual(
      result.annotations,
      [
        `::warning title=CI duration budget::The shard balance was not checked: ${note}`,
      ],
      note,
    );
  }
});
