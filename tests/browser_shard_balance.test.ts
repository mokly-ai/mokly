import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { discoverBrowserTests } from "../scripts/verification/playwright.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

/** Largest multiple of an even share of browser tests one CI shard may hold. */
const SHARE_LIMIT = 1.25;

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

test("every CI browser shard holds at most 125% of an even share of tests", async () => {
  const total = await browserShardTotal();
  const shards = await Promise.all(
    Array.from({ length: total }, (_, offset) =>
      discoverBrowserTests(repositoryRoot, { index: offset + 1, total }),
    ),
  );
  const counts = shards.map((shard) => shard.tests.length);
  const browserTests = counts.reduce((sum, count) => sum + count, 0);
  const limit = Math.ceil((browserTests / total) * SHARE_LIMIT);
  for (const [offset, count] of counts.entries())
    assert.ok(
      count <= limit,
      `browser shard ${offset + 1}/${total} holds ${count} of ${browserTests} tests, above the limit of ${limit}; ` +
        'put a large spec of independent tests in test.describe.configure({ mode: "parallel" }) or split it',
    );
});

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
