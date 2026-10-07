import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { ensureCacheIgnore } from "../dist/config/cache_ignore.js";

import { baselineFixture, success } from "./helpers/baseline_fixture.js";
import { MemoryBaselineFileSystem } from "./helpers/baseline_memory.js";
import { CACHE_IGNORE_TEXT } from "./helpers/cache_ignore.js";

test("a baseline build that fails still leaves an ignored cache", async () => {
  const fixture = baselineFixture();
  fixture.runner.run = async () => ({
    ...success,
    exitCode: 1,
    output: "missing commit",
  });
  await assert.rejects(fixture.builder.build(fixture.request), {
    code: "baseline-history-unavailable",
  });
  const ignore = await fixture.fs.read("/repo/.mokly-cache/.gitignore", 1024);
  assert.equal(Buffer.from(ignore).toString("utf8"), CACHE_IGNORE_TEXT);
});

test("a failed publication removes its temporary file and reports the error", async () => {
  const files = new MemoryBaselineFileSystem();
  const failure = new Error("disk full");
  files.rename = async () => {
    throw failure;
  };
  await assert.rejects(ensureCacheIgnore(files, "/repo"), failure);
  assert.deepEqual(await files.list("/repo"), []);
});

test("a writer that loses the publication keeps the other writer's file", async () => {
  const files = new MemoryBaselineFileSystem();
  files.rename = async (_from, to) => {
    files.put(to, "regular", Buffer.from(CACHE_IGNORE_TEXT));
    throw new Error("busy");
  };
  await ensureCacheIgnore(files, "/repo");
  assert.deepEqual(await files.list("/repo"), [".gitignore"]);
});

test("baseline debris and retention preserve the cache ignore file and its identity", async () => {
  const { builder, request, fs, clock } = baselineFixture();
  await builder.build(request);
  const layout = cacheLayout(request.repoRoot, request.commit);
  const ignore = path.join(layout.cache, ".gitignore");
  const contents = Buffer.from(`${CACHE_IGNORE_TEXT}# Consumer note\n`);
  fs.put(ignore, "regular", contents);
  const identity = (await fs.stat(ignore))!.identity;
  const discard = path.join(layout.entry, `discard-${"f".repeat(40)}`);
  fs.put(discard, "directory");
  fs.put(path.join(discard, "old-output"), "regular");

  assert.equal((await builder.build(request)).cacheHit, true);
  assert.equal(await fs.stat(discard), undefined);
  assert.equal((await fs.stat(ignore))!.identity, identity);
  assert.deepEqual(await fs.read(ignore, 1024), contents);

  for (const letter of ["b", "c", "d"]) {
    clock.time++;
    await builder.build({ ...request, commit: letter.repeat(40) });
  }
  assert.equal(await fs.stat(layout.entry), undefined);
  assert.equal((await fs.stat(ignore))!.identity, identity);
  assert.deepEqual(await fs.read(ignore, 1024), contents);
});
