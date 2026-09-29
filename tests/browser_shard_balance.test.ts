import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import {
  discoverBrowserTests,
  type BrowserTestInventory,
} from "../scripts/verification/playwright.mjs";
import { validateShardReports } from "../scripts/verification/report-validation.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { unitReport } from "./helpers/verification_evidence.js";

/** Largest multiple of an even share of browser tests one CI shard may hold. */
const SHARE_LIMIT = 1.25;

const REPORT_COMMIT = "a".repeat(40);
const REPORT_RUNTIME = "node-24.21.0";

interface CiWorkflow {
  readonly jobs?: Readonly<
    Record<
      string,
      {
        readonly strategy?: { readonly matrix?: { readonly shard?: unknown } };
      }
    >
  >;
}

interface ListedShards {
  readonly complete: BrowserTestInventory;
  readonly shards: readonly BrowserTestInventory[];
  readonly total: number;
}

test("every CI browser shard holds at most 125% of an even share of tests", async () => {
  const { shards, total } = await listedShards();
  const counts = shards.map((shard) => shard.tests.length);
  const browserTests = counts.reduce((sum, count) => sum + count, 0);
  const limit = Math.ceil((browserTests / total) * SHARE_LIMIT);
  for (const [offset, count] of counts.entries())
    assert.ok(
      count <= limit,
      `browser shard ${offset + 1}/${total} holds ${count} of ${browserTests} tests, above the limit of ${limit}; split a large spec into smaller spec files`,
    );
});

test("CI browser shard listings satisfy the evidence aggregate", async () => {
  const { complete, shards, total } = await listedShards();
  const reports = shards.map((shard, offset) =>
    listedShardReport(offset + 1, total, shard, complete),
  );
  assert.doesNotThrow(
    () =>
      validateShardReports(reports, {
        commit: REPORT_COMMIT,
        runtime: REPORT_RUNTIME,
        suite: "browser",
        total,
      }),
    "every browser spec must stay whole within one shard; split a large spec into smaller spec files instead of using parallel mode",
  );
});

let listing: Promise<ListedShards> | undefined;

function listedShards(): Promise<ListedShards> {
  listing ??= listShards();
  return listing;
}

async function listShards(): Promise<ListedShards> {
  const total = await browserShardTotal();
  const [complete, shards] = await Promise.all([
    discoverBrowserTests(repositoryRoot),
    Promise.all(
      Array.from({ length: total }, (_, offset) =>
        discoverBrowserTests(repositoryRoot, { index: offset + 1, total }),
      ),
    ),
  ]);
  return { complete, shards, total };
}

function listedShardReport(
  index: number,
  total: number,
  shard: BrowserTestInventory,
  complete: BrowserTestInventory,
) {
  return {
    ...unitReport(index, shard.files, complete.files),
    commit: REPORT_COMMIT,
    runtime: REPORT_RUNTIME,
    suite: "browser",
    shard: { index, total },
    fullTests: complete.tests,
    assignedTests: shard.tests,
    observedTests: shard.tests.map((entry) => ({
      ...entry,
      durationMs: 1,
      status: "passed",
      errors: [],
    })),
  };
}

async function browserShardTotal(): Promise<number> {
  const workflow = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ),
  ) as CiWorkflow;
  const shards = workflow.jobs?.browser?.strategy?.matrix?.shard;
  assert.ok(
    Array.isArray(shards) && shards.length > 0,
    "the CI browser job declares a shard matrix",
  );
  return shards.length;
}
