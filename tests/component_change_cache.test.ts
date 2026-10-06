import assert from "node:assert/strict";
import { test } from "node:test";

import { ComponentChangeCache } from "../packages/mokly/dist/server/component_change_cache.js";

test("lightweight component classification coalesces by generation and resolved baseline", async () => {
  let baseline = "first";
  let calls = 0;
  const cache = new ComponentChangeCache({
    baseline: async () => baseline,
    read: async () => {
      calls++;
      return undefined;
    },
  });
  await Promise.all([cache.read(1), cache.read(1), cache.read(1)]);
  assert.equal(calls, 1);
  await cache.read(2);
  assert.equal(calls, 2);
  baseline = "second";
  await cache.read(2);
  assert.equal(calls, 3);
  cache.invalidate();
  await cache.read(2);
  assert.equal(calls, 4);
});

test("a stale classification cannot replace the current generation's cached result", async () => {
  let calls = 0;
  const releases: (() => void)[] = [];
  const cache = new ComponentChangeCache({
    baseline: async () => "base",
    read: async () => {
      calls++;
      await new Promise<void>((resolve) => releases.push(resolve));
      return undefined;
    },
  });
  const old = cache.read(1);
  await Promise.resolve();
  await Promise.resolve();
  const current = cache.read(2);
  await Promise.resolve();
  await Promise.resolve();
  releases[1]!();
  await current;
  releases[0]!();
  await old;
  await cache.read(2);
  assert.equal(calls, 2);
});

test("late baseline lookups cannot displace a newer request's cached material", async () => {
  const baselineResolvers: ((commit: string) => void)[] = [];
  let reads = 0;
  const cache = new ComponentChangeCache({
    baseline: () =>
      new Promise<string>((resolve) => baselineResolvers.push(resolve)),
    read: async () => {
      reads++;
      return undefined;
    },
  });
  const old = cache.read(1);
  const current = cache.read(2);
  baselineResolvers[1]!("current");
  await current;
  baselineResolvers[0]!("old");
  await old;
  const again = cache.read(2);
  baselineResolvers[2]!("current");
  await again;
  assert.equal(reads, 2);
});
