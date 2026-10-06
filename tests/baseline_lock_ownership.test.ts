import assert from "node:assert/strict";
import test from "node:test";

import { cacheLayout } from "../packages/mokly/dist/baseline/cache_layout.js";
import { tryBaselineLock } from "../packages/mokly/dist/baseline/lock.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";

test("lock ownership is returned without a fallible metadata read after publication", async (t) => {
  const { fs, runner, clock, request } = baselineFixture();
  const layout = cacheLayout(request.repoRoot, request.commit);
  const stat = t.mock.method(fs, "stat", async () => {
    throw new Error("metadata unavailable");
  });
  const lock = await tryBaselineLock(fs, runner, clock, layout);
  assert.ok(lock);
  assert.equal(stat.mock.calls.length, 0);
  stat.mock.restore();
  await lock.release();
  assert.equal(await fs.stat(layout.lock), undefined);
});
