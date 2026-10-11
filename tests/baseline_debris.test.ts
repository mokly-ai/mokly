import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";

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

test("the debris name table removes only recognized abandoned regular temporaries", async () => {
  const { builder, request, fs } = baselineFixture();
  await builder.build(request);
  const layout = cacheLayout(request.repoRoot, request.commit);
  const uuid = "12345678-1234-4234-8234-123456789abc";
  const table = [
    [`discard-${"c".repeat(40)}`, "directory", true],
    [`discard-${"d".repeat(64)}`, "regular", true],
    [`discard-${"e".repeat(40)}`, "symlink", false],
    [`discard-${"f".repeat(64)}`, "other", false],
    [`.lock-9999-${uuid}`, "regular", true],
    [`.lock-42-${uuid}`, "regular", false],
    [`.lock-9007199254740992-${uuid}`, "regular", false],
    [`complete-${uuid}.tmp`, "regular", true],
    [`lock.retired-${"f".repeat(64)}`, "regular", false],
    ["complete-unknown.tmp", "regular", false],
    ["complete-12345678-1234-4234-8234-123456789abz.tmp", "regular", false],
    ["discard-unknown", "directory", false],
    [`.lock-0-${uuid}`, "regular", false],
    [`.lock-${uuid}`, "regular", false],
    [".gitignore", "regular", false],
    ["unknown.tmp", "regular", false],
  ] as const;
  const ignore = path.join(layout.cache, ".gitignore");
  const ignored = await fs.read(ignore, 1024);
  const locks = path.join(layout.cache, "locks");
  fs.put(locks, "directory");
  for (const [name, kind] of table) {
    fs.put(path.join(layout.entry, name), kind, Buffer.from("temporary"));
    if (kind === "directory")
      fs.put(path.join(layout.entry, name, "contents"), "regular");
  }
  assert.equal((await builder.build(request)).cacheHit, true);
  for (const [name, , removed] of table)
    assert.equal(
      Boolean(await fs.stat(path.join(layout.entry, name))),
      !removed,
      name,
    );
  assert.deepEqual(await fs.read(ignore, 1024), ignored);
  assert.equal((await fs.stat(locks))?.kind, "directory");
  assert.ok(await fs.stat(layout.marker));
  for (const kind of ["symlink", "other", "directory"] as const) {
    for (const name of [`.lock-9999-${uuid}`, `complete-${uuid}.tmp`])
      fs.put(path.join(layout.entry, name), kind);
    assert.equal((await builder.build(request)).cacheHit, true);
    for (const name of [`.lock-9999-${uuid}`, `complete-${uuid}.tmp`])
      assert.equal((await fs.stat(path.join(layout.entry, name)))?.kind, kind);
  }
});
