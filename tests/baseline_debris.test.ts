import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../packages/mokly/dist/baseline/cache_layout.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";

test("warm cache maintenance removes crash debris while retaining live lock candidates and tombstones", async () => {
  const { builder, request, fs } = baselineFixture();
  await builder.build(request);
  const layout = cacheLayout(request.repoRoot, request.commit);
  const discard = path.join(layout.entry, `discard-${"b".repeat(40)}`);
  const dead = path.join(
    layout.entry,
    ".lock-9999-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  const live = path.join(
    layout.entry,
    ".lock-42-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  const retired = path.join(layout.entry, `lock.retired-${"f".repeat(64)}`);
  fs.put(discard, "directory");
  fs.put(path.join(discard, "old-output"), "regular");
  for (const name of [dead, live, retired]) fs.put(name, "regular");
  assert.equal((await builder.build(request)).cacheHit, true);
  assert.equal(await fs.stat(discard), undefined);
  assert.equal(await fs.stat(dead), undefined);
  assert.ok(await fs.stat(live));
  assert.ok(
    await fs.stat(retired),
    "tombstones protect against stale concurrent reclaimers",
  );
  assert.ok(await fs.stat(layout.marker));
});

test("debris maintenance failures are reported without invalidating cached output", async (t) => {
  const { builder, request, fs, maintenance } = baselineFixture();
  await builder.build(request);
  const layout = cacheLayout(request.repoRoot, request.commit);
  const discard = path.join(layout.entry, `discard-${"b".repeat(40)}`);
  fs.put(discard, "directory");
  const remove = fs.remove.bind(fs);
  t.mock.method(fs, "remove", async (file: string) => {
    if (file === discard) throw new Error("cannot remove discarded output");
    await remove(file);
  });
  assert.equal((await builder.build(request)).cacheHit, true);
  assert.ok(maintenance.some((failure) => failure.entry === discard));
  assert.ok(await fs.stat(layout.marker));
});
